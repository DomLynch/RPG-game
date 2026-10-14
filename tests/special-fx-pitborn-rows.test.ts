import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-pitborn-rows.ts';

// special-fx-pitborn.ts's named numbers are rows (special-fx-pitborn-defs.json); the values must be exactly the literals the file held before.
test('special-fx-pitborn rows give exactly the numbers special-fx-pitborn.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"BUILD": 30});
});
