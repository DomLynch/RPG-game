import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/fight/tithe-rows.ts';
import { ARM_OUT, ARM_EASE, AIM_HOLD } from '../src/fight/special-tithe.ts';

// The Blood Tithe dials are rows (tithe-defs.json); the values must be exactly the literals special-tithe.ts held before.
test('tithe rows give exactly the numbers special-tithe.ts used to hold', () => {
  assert.deepEqual(
    [T.DUST, T.MOTE_MAX, T.CHARGE, T.BURST, T.BURST_LIFE, T.BURST_ALPHA, T.BURST_SPREAD, T.CONE, T.SETTLE_FADE, T.LIGHT_PEAK, T.LIGHT_FADE, T.RADIUS, T.RISE, T.KEEP_OFF, T.ARM_OUT, T.ARM_EASE, T.AIM_HOLD],
    [12, 0.4, 8, 36, 0.5, 0.3, 0.1, 0.4, 24, 0.38, 24, 1.5, 0.8, 0.6, 0.5, 16, 14]);
  assert.deepEqual([ARM_OUT, ARM_EASE, AIM_HOLD], [0.5, 16, 14], 'special-tithe.ts still exports the arm dials');
});
