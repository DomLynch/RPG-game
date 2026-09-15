import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFeedback } from '../src/feedback.ts';

// Minimal Web Audio stand-in: enough surface for unlock/quiet/play to run without a browser.
class FakeContext {
  static last: FakeContext | undefined; static made = 0;
  state = 'suspended'; resumed = 0; sampleRate = 48000; currentTime = 0; destination = {};
  constructor() { FakeContext.made++; FakeContext.last = this; }
  createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; }, disconnect() {} }; }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource(): never { throw new Error('play must not reach the graph while the context is not running'); }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
function withFakeAudio(audioSession: { type: string } | undefined, run: () => void) {
  const g = globalThis as unknown as { AudioContext?: unknown; navigator?: unknown };
  const priorContext = g.AudioContext, priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  g.AudioContext = FakeContext; FakeContext.made = 0; FakeContext.last = undefined;
  Object.defineProperty(globalThis, 'navigator', { value: audioSession ? { audioSession } : {}, configurable: true });
  try { run(); } finally {
    g.AudioContext = priorContext;
    if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator); else delete g.navigator;
  }
}

test('unlock creates one context inside the gesture and opts into an iOS playback audio session', () => withFakeAudio({ type: 'auto' }, () => {
  const feedback = createFeedback();
  feedback.update([{ tick: 1, type: 'Hit', actor: 0 } as never]); // before any gesture: silent, and no context is created
  assert.equal(FakeContext.made, 0);
  feedback.unlock(); feedback.unlock();
  assert.equal(FakeContext.made, 1, 'one context for the page');
  assert.equal(FakeContext.last!.resumed, 1, 'a suspended context is resumed once');
  assert.equal((globalThis.navigator as { audioSession: { type: string } }).audioSession.type, 'playback');
}));

test('unlock resumes an interrupted context (iOS after a call or app switch), and leaves a running one alone', () => withFakeAudio(undefined, () => {
  const feedback = createFeedback(); feedback.unlock();
  const context = FakeContext.last!;
  assert.equal(context.state, 'running');
  feedback.unlock(); assert.equal(context.resumed, 1, 'running: not resumed again');
  context.state = 'interrupted';
  feedback.unlock(); assert.equal(context.resumed, 2, 'interrupted: resumed'); assert.equal(context.state, 'running');
  feedback.quiet(); assert.equal(context.state, 'suspended');
  feedback.unlock(); assert.equal(context.resumed, 3, 'suspended: resumed');
}));

test('the shell unlocks audio on the events WebKit treats as user activation, not only pointerdown', () => {
  const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const line = source.split('\n').find(l => l.includes('feedback.unlock()') && l.includes('addEventListener'));
  assert.ok(line, 'unlock listener registration exists');
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) assert.ok(line!.includes(`'${type}'`), `unlock is bound to ${type}`);
});
