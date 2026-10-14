import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-legion-rows.ts';

// special-fx-legion.ts's named numbers are rows (special-fx-legion-defs.json); the values must be exactly the literals the file held before.
test('special-fx-legion rows give exactly the numbers special-fx-legion.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"RING": 26});
});
