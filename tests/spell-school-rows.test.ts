import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/spell-school-rows.ts';

// spell-school.ts's named numbers are rows (spell-school-defs.json); the values must be exactly the literals the file held before.
test('spell-school rows give exactly the numbers spell-school.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"SOFT_FLOOR": 12});
});
