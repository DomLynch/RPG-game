import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/roll-rows.ts';

// roll.ts's named numbers are rows (roll-defs.json); the values must be exactly the literals the file held before.
test('roll rows give exactly the numbers roll.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"ROLL_BAND": 10});
});
