import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATE_CUT, playGate } from '../src/audio/gate.ts';

const decoded = { duration: 5 } as AudioBuffer;

const voiceOn = (delay: number) => {
  const calls: string[] = [];
  const gain = { value: 0, cancelScheduledValues: (t: number) => calls.push(`cancel ${t}`), setValueAtTime: (v: number, t: number) => calls.push(`set ${v} ${t}`), linearRampToValueAtTime: (v: number, t: number) => calls.push(`ramp ${v} ${t.toFixed(3)}`) };
  const source = { buffer: null as AudioBuffer | null, connect() {}, disconnect() {}, start: (t: number) => calls.push(`start ${t}`), stop: (t: number) => calls.push(`stop ${t.toFixed(3)}`), onended: null as (() => void) | null };
  const ctx = { currentTime: 10, createBufferSource: () => source, createGain: () => ({ gain, connect() {}, disconnect() {} }) } as unknown as BaseAudioContext;
  return { voice: playGate(ctx, decoded, {} as AudioNode, .5, delay), gain, calls };
};

test('a skipped gate beat fades out over GATE_CUT and never twice', () => {
  const { voice, gain, calls } = voiceOn(0);
  assert.equal(voice.duration, 5);
  assert.equal(gain.value, .5);
  assert.deepEqual(calls, ['start 10']);
  voice.stop(); voice.stop();
  assert.deepEqual(calls.slice(1), ['cancel 10', 'set 0.5 10', `ramp 0 ${(10 + GATE_CUT).toFixed(3)}`, `stop ${(10 + GATE_CUT + .01).toFixed(3)}`]);
});

test('a skip before a delayed start is silent: gain 0 and the source cancelled at its start time, no fade tick', () => {
  const { voice, gain, calls } = voiceOn(.2);
  assert.deepEqual(calls, ['start 10.2']);
  voice.stop(); voice.stop();
  assert.equal(gain.value, 0);
  assert.deepEqual(calls.slice(1), ['stop 10.200']);
});
