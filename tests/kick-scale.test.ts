import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kickScale, kickScaleFlag, scaleShove, KICK_REF_DIST } from '../src/kick-scale.ts';

test('the flag is opt-in and combines with other look tokens', () => {
  assert.equal(kickScaleFlag(''), false);
  assert.equal(kickScaleFlag('?look=kickscale'), true);
  assert.equal(kickScaleFlag('?look=souls,kickscale&x=1'), true);
  assert.equal(kickScaleFlag('?look=kickscalex'), false);
});
test('the reference framing is unchanged and the scale holds the screen size, clamped', () => {
  assert.equal(kickScale(KICK_REF_DIST), 1);
  assert.equal(kickScale(1), 0.7);
  assert.equal(kickScale(20), 1.6);
  for (const d of [2.5, 3.5, 5]) assert.ok(Math.abs((0.04 * kickScale(d)) / d - 0.04 / 3.5) < 1e-9);
});
test('scaleShove scales the offsets, never the timing', () => {
  const s = scaleShove({ along: 0.05, drop: 0.06, side: 0.02, hold: 2 / 60, settle: 0.22, screen: 0.04 }, 1.5);
  [[s.along, 0.075], [s.drop, 0.09], [s.side, 0.03], [s.screen, 0.06]].forEach(([a, b]) => assert.ok(Math.abs(a! - b!) < 1e-12));
  assert.deepEqual([s.hold, s.settle, s.push], [2 / 60, 0.22, undefined]);
});
