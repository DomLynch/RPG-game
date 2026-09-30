import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { GATE_CUT, loadGate, playGate } from '../src/audio/gate.ts';

const dir = new URL('../src/assets/gate-audio/', import.meta.url);
test('the gate winch ships in both formats, small, inside the lane budget', () => {
  for (const file of ['gate.ogg', 'gate.m4a']) {
    const bytes = fs.readFileSync(new URL(file, dir)), gzip = gzipSync(bytes).length;
    assert.ok(bytes.length > 1000, `${file} is present`);
    assert.ok(gzip <= 60_000, `${file} is ${gzip} B gzip; the winch is a ~5 s cue and stays under 60 kB per format`);
  }
});

const decoded = { duration: 5 } as AudioBuffer;
const okFetch = (log: string[]) => (async (url: string) => { log.push(url.slice(url.lastIndexOf('/') + 1)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response; }) as unknown as typeof fetch;
const context = (fail = false) => ({ decodeAudioData: async () => { if (fail) throw new Error('unsupported'); return decoded; } }) as unknown as BaseAudioContext;

test('loadGate takes the first format that decodes, falls back to the other, and stays silent when the page is leaving', async () => {
  const first: string[] = [];
  assert.equal(await loadGate(context(), ['opus', 'aac'], okFetch(first), () => false), decoded);
  assert.deepEqual(first, ['gate.ogg']);
  const retry: string[] = [];
  let calls = 0;
  const flaky = { decodeAudioData: async () => { if (!calls++) throw new Error('unsupported'); return decoded; } } as unknown as BaseAudioContext;
  assert.equal(await loadGate(flaky, ['opus', 'aac'], okFetch(retry), () => false), decoded);
  assert.deepEqual(retry, ['gate.ogg', 'gate.m4a']);
  const none: string[] = [];
  assert.equal(await loadGate(context(true), ['opus', 'aac'], okFetch(none), () => false), null);
  assert.deepEqual(none, ['gate.ogg', 'gate.m4a']);
  const leaving: string[] = [];
  assert.equal(await loadGate(context(), ['opus', 'aac'], okFetch(leaving), () => true), null);
  assert.deepEqual(leaving, []);
});

test('a skipped gate beat fades out over GATE_CUT and never twice', () => {
  const calls: string[] = [];
  const gain = { value: 0, cancelScheduledValues: (t: number) => calls.push(`cancel ${t}`), setValueAtTime: (v: number, t: number) => calls.push(`set ${v} ${t}`), linearRampToValueAtTime: (v: number, t: number) => calls.push(`ramp ${v} ${t.toFixed(3)}`) };
  const source = { buffer: null as AudioBuffer | null, connect() {}, disconnect() {}, start: (t: number) => calls.push(`start ${t}`), stop: (t: number) => calls.push(`stop ${t.toFixed(3)}`), onended: null as (() => void) | null };
  const ctx = { currentTime: 10, createBufferSource: () => source, createGain: () => ({ gain, connect() {}, disconnect() {} }) } as unknown as BaseAudioContext;
  const voice = playGate(ctx, decoded, {} as AudioNode, .5, .2);
  assert.equal(voice.duration, 5);
  assert.equal(gain.value, .5);
  assert.deepEqual(calls, ['start 10.2']);
  voice.stop(); voice.stop();
  assert.deepEqual(calls.slice(1), ['cancel 10.2', 'set 0.5 10.2', `ramp 0 ${(10.2 + GATE_CUT).toFixed(3)}`, `stop ${(10.2 + GATE_CUT + .01).toFixed(3)}`]);
});
