import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-quake-rows.ts';

// special-fx-quake.ts's named numbers are rows (special-fx-quake-defs.json); the values must be exactly the literals the file held before.
test('special-fx-quake rows give exactly the numbers special-fx-quake.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"RIM": 0.6, "STRIPS": 11, "SHEETS": 6, "GRIT": 220, "DUST": 24, "CAP": 0.92, "CAP_PIT": 0.4});
});
