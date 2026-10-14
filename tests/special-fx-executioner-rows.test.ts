import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-executioner-rows.ts';

// special-fx-executioner.ts's named numbers are rows (special-fx-executioner-defs.json); the values must be exactly the literals the file held before.
test('special-fx-executioner rows give exactly the numbers special-fx-executioner.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"BUILD": 30, "GRIT": 160});
});
