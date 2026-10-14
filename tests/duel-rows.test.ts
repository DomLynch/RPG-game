import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/duel-rows.ts';

// duel.ts's named numbers are rows (duel-defs.json); the values must be exactly the literals the file held before.
test('duel rows give exactly the numbers duel.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"PERK_MAX": 30});
});
