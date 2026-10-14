import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-goblin-rows.ts';

// special-fx-goblin.ts's named numbers are rows (special-fx-goblin-defs.json); the values must be exactly the literals the file held before.
test('special-fx-goblin rows give exactly the numbers special-fx-goblin.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"PUFFS": 28, "SPECKS": 44, "PRINTS": 8, "GHOST_SINCE": 0.1, "SCOOP_TICKS": 48, "DIP": 0.22});
});
