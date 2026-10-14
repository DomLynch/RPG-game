import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-modes-rows.ts';

// special-modes.ts's named numbers are rows (special-modes-defs.json); the values must be exactly the literals the file held before.
test('special-modes rows give exactly the numbers special-modes.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"TITHE_CHAMBER": 0.55, "TITHE_CHAMBER_FROM": 0.84, "TITHE_STRIKE_FROM": 0.92});
});
