import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/boss-telegraph-rows.ts';

// boss-telegraph.ts's named numbers are rows (boss-telegraph-defs.json); the values must be exactly the literals the file held before.
test('boss-telegraph rows give exactly the numbers boss-telegraph.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"ROLL_TICKS": 24});
});
