import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-class-rows.ts';

// special-fx-class.ts's named numbers are rows (special-fx-class-defs.json); the values must be exactly the literals the file held before.
test('special-fx-class rows give exactly the numbers special-fx-class.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"DECALS": 48, "GRIT": 72});
});
