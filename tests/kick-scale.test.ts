import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kickScale, kickScaleFlag, scaleShove, KICK_REF_CAM, KICK_REF_SEP } from '../src/kick-scale.ts';

test('the flags are opt-in, combine with other look tokens, and name their mode', () => {
  assert.equal(kickScaleFlag(''), null);
  assert.equal(kickScaleFlag('?look=kickscale'), 'cam');
  assert.equal(kickScaleFlag('?look=souls,kickscale&x=1'), 'cam');
  assert.equal(kickScaleFlag('?look=kickscale-sep'), 'sep');
  assert.equal(kickScaleFlag('?look=kickscalex'), null);
});
test('camera mode holds the screen size: x1.0 at the reference, clamped', () => {
  assert.equal(kickScale('cam', KICK_REF_CAM, 9), 1);
  assert.ok(Math.abs(0.04 * kickScale('cam', 4.2, 9) / 4.2 - 0.04 / KICK_REF_CAM) < 1e-9);
  assert.equal(kickScale('cam', 1, 9), 0.7);
  assert.equal(kickScale('cam', 20, 9), 1.6);
});
test('separation mode: median x1.0, closer softer, wider harder, clamped', () => {
  assert.equal(kickScale('sep', 9, KICK_REF_SEP), 1);
  assert.ok(Math.abs(kickScale('sep', 9, 1.0) - 0.8) < 1e-9 && Math.abs(kickScale('sep', 9, 1.6) - 1.28) < 1e-9);
  assert.equal(kickScale('sep', 9, 0.5), 0.7);
  assert.equal(kickScale('sep', 9, 5), 1.6);
});
test('scaleShove scales the offsets, never the timing', () => {
  const s = scaleShove({ along: 0.05, drop: 0.06, side: 0.02, hold: 2 / 60, settle: 0.22, screen: 0.04 }, 1.5);
  [[s.along, 0.075], [s.drop, 0.09], [s.side, 0.03], [s.screen, 0.06]].forEach(([a, b]) => assert.ok(Math.abs(a! - b!) < 1e-12));
  assert.deepEqual([s.hold, s.settle, s.push], [2 / 60, 0.22, undefined]);
});
