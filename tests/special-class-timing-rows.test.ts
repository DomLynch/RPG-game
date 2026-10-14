import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-class-timing-rows.ts';

// special-class-timing.ts's named numbers are rows (special-class-timing-defs.json); the values must be exactly the literals the file held before.
test('special-class-timing rows give exactly the numbers special-class-timing.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"BACK_TICKS": 30, "LATERAL": 0.8, "STEP_WINDOW": 26, "DRAG_FROM": 36});
});
