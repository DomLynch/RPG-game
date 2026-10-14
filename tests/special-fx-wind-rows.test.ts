import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-wind-rows.ts';

// special-fx-wind.ts's named numbers are rows (special-fx-wind-defs.json); the values must be exactly the literals the file held before.
test('special-fx-wind rows give exactly the numbers special-fx-wind.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"CAP": 0.8, "STREAKS": 11, "SHEETS": 4, "GRIT": 80, "GATHER_TICKS": 30});
});
