import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-timing-rows.ts';

// special-timing.ts's named numbers are rows (special-timing-defs.json); the values must be exactly the literals the file held before.
test('special-timing rows give exactly the numbers special-timing.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"DROP_TICKS": 24, "RIPPLE": 30, "CAST_MARGIN": 60, "CUTS": 7, "CUT_GAP": 4, "DISSOLVE_TICKS": 20, "BOSS_TAIL": 84});
});
