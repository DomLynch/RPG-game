import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/witchfire-rows.ts';

// witchfire.ts's named numbers are rows (witchfire-defs.json); the values must be exactly the literals the file held before.
test('witchfire rows give exactly the numbers witchfire.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"POOL": 200});
});
