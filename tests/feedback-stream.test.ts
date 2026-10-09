import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeedback } from '../src/fight/sound/feedback.ts';

// The export-clip seam (SCOPE 5): feedback.stream() taps the mixed game audio off master for src/clip.ts's recorder, and
// feedback.untap() drops the tap when the clip ends. A fake AudioContext records every connect/disconnect, so the test pins
// where the tap sits in the graph without a browser.
class Node {
  out = new Set<object>();
  gain = { value: 1, setValueAtTime() {} };
  threshold = { value: 0 }; knee = { value: 0 }; ratio = { value: 0 }; attack = { value: 0 }; release = { value: 0 };
  curve: unknown; oversample = ''; buffer: unknown;
  connect(to: object) { this.out.add(to); return to; }
  disconnect(to: object) { if (!this.out.delete(to)) throw Error('not connected'); }
}
class FakeContext {
  static made: FakeContext[] = [];
  state = 'running'; currentTime = 0; sampleRate = 48000; destination = new Node(); gains: Node[] = [];
  streams: { stream: object }[] = [];
  constructor() { FakeContext.made.push(this); }
  createGain() { const n = new Node(); this.gains.push(n); return n; }
  createWaveShaper() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createConvolver() { return new Node(); }
  createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  createMediaStreamDestination() { const n = Object.assign(new Node(), { stream: { id: `mix-${this.streams.length}` } }); this.streams.push(n); return n; }
  decodeAudioData() { return Promise.reject(Error('no codec')); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
}

test('feedback.stream() taps master once for the clip recorder and untap() releases it', async () => {
  const globals = globalThis as Record<string, unknown>, saved = { AudioContext: globals.AudioContext, fetch: globals.fetch };
  globals.AudioContext = FakeContext;
  globals.fetch = () => Promise.reject(Error('offline'));   // the sprite load fails quietly; the graph is what is under test
  try {
    const feedback = createFeedback();
    assert.equal(feedback.stream(), null, 'no stream before the first unlock: there is no context to tap');
    feedback.unlock();
    const context = FakeContext.made.at(-1)!, master = context.gains[0];
    assert.ok(master.out.has(context.destination), 'the first gain built is master, wired to the speakers');
    const stream = feedback.stream();
    assert.equal(stream, context.streams[0].stream, 'the stream is the MediaStream destination\'s own');
    assert.ok(master.out.has(context.streams[0]) && master.out.has(context.destination), 'tapped beside the speakers, which keep playing');
    assert.equal(feedback.stream(), stream, 'a second clip reuses the one destination');
    assert.equal(context.streams.length, 1);
    feedback.untap();
    assert.ok(!master.out.has(context.streams[0]) && master.out.has(context.destination), 'untap drops the tap only');
    assert.doesNotThrow(() => feedback.untap(), 'a second untap is harmless');
    assert.equal(feedback.stream(), stream, 'a later clip re-taps the same destination');
    assert.ok(master.out.has(context.streams[0]));
  } finally { globals.AudioContext = saved.AudioContext; globals.fetch = saved.fetch; }
});

test('feedback.stream() is null on the offline harness', () => {
  const context = new FakeContext() as unknown as BaseAudioContext;
  const feedback = createFeedback({ context, now: () => 0, sprite: null } as unknown as Parameters<typeof createFeedback>[0]);
  feedback.unlock();
  assert.equal(feedback.stream(), null, 'OfflineAudioContext renders have no live stream to record');
});
