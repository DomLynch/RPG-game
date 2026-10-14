import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-boss-rows.ts';

// special-fx-boss.ts's named numbers are rows (special-fx-boss-defs.json); the values must be exactly the literals the file held before.
test('special-fx-boss rows give exactly the numbers special-fx-boss.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"PIT_MIST": 0.13, "PIT_STAIN": 0.07, "PIT_BREATH": 0.03, "MIST": 64, "GHOST": 23, "FLIES": 280, "WISP": 30, "RING": 18, "VEILS": 6, "DROPS": 260});
});
