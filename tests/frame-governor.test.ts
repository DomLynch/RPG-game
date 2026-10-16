// The frame governor (origins/preview/frame-governor.ts): the p95 of the last window decides LOW (the smaller full count of remote figures) and HIGH, with a gap between the two thresholds and a full window before any change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGovernor } from '../origins/preview/frame-governor.ts';
import { previewRule } from '../origins/preview/preview-rules.ts';

const rules = { windowMs: previewRule('remoteAdaptWindowMs'), slowMs: previewRule('remoteAdaptSlowMs'), okMs: previewRule('remoteAdaptOkMs'), judgeMs: previewRule('remoteAdaptJudgeMs'), percentile: previewRule('remoteAdaptPercentile') };
/** Feed `seconds` of frames of length `ms` starting at `t0`; returns the time after the last frame. */
const run = (g: ReturnType<typeof createGovernor>, t0: number, seconds: number, ms: number, every?: { n: number; ms: number }): number => {
  let t = t0, i = 0;
  while (t - t0 < seconds * 1000) { const len = every && ++i % every.n === 0 ? every.ms : ms; t += len; g.push(len, t); }
  return t;
};

test('steady 60 fps never drops; the rule values are the ruled ones (33 ms to drop, 25 ms to return, 3 s window)', () => {
  assert.deepEqual([rules.slowMs, rules.okMs, rules.windowMs], [33, 25, 3000]);
  const g = createGovernor(rules); run(g, 0, 20, 16.7);
  assert.equal(g.low(), false);
});

test('a frame time that stays above the slow threshold for a window drops to LOW, and not before the window is full', () => {
  const g = createGovernor(rules); let t = 0;
  t = run(g, t, 2, 60); assert.equal(g.low(), false, 'two seconds of 60 ms frames: the window (3 s) is not full yet');
  run(g, t, 2, 60); assert.equal(g.low(), true, 'past the window it drops');
});

test('a short spike does not flip it, and it returns only after a full window under the ok threshold (no flapping at the edge)', () => {
  const g = createGovernor(rules); let t = run(g, 0, 10, 16.7);
  t = run(g, t, 0.5, 16.7, { n: 2, ms: 90 }); assert.equal(g.low(), false, 'half a second of spikes inside a window of fast frames is under 5 % of the window: its p95 stays low');
  t = run(g, t, 4, 70); assert.equal(g.low(), true);
  t = run(g, t, 5, 29); assert.equal(g.low(), true, '29 ms is under the drop threshold but not under the return threshold: it stays LOW');
  t = run(g, t, 2, 16.7); assert.equal(g.low(), true, 'two seconds back at 60 fps: the window is not clean yet');
  run(g, t, 3, 16.7); assert.equal(g.low(), false, 'a full clean window: HIGH again');
});
