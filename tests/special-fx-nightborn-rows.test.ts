import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-nightborn-rows.ts';

// special-fx-nightborn.ts's named numbers are rows (special-fx-nightborn-defs.json); the values must be exactly the literals the file held before.
test('special-fx-nightborn rows give exactly the numbers special-fx-nightborn.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"CAP": 0.88});
});
