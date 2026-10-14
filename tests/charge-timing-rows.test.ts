import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/charge-timing-rows.ts';

// charge-timing.ts's named numbers are rows (charge-timing-defs.json); the values must be exactly the literals the file held before.
test('charge-timing rows give exactly the numbers charge-timing.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"RACE": 36, "DISSOLVE": 20, "CUE_LEAD": 57, "GATHER": 18, "RIDE": 24, "BACK_PACE": -1.7, "RUN_PACE": 4});
});
