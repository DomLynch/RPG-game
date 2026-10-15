import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/duel-rows.ts';

// duel.ts's named numbers are rows (duel-defs.json); the values must be exactly the literals the file held before.
test('duel rows give exactly the numbers duel.ts used to hold', () => {
  assert.deepEqual({ ...R }, { PERK_MAX: 30, PER_MILLE: 1000, MAX_PERK_TEMPLATES: 2, FULL_TURN: 2, LORARIUS_SECTORS: 3, BODY_SPACING: 0.85, MOVE_EPSILON: 0.1, GAP_EPSILON: 1e-8, PUSH_SPLIT: 2, ROLL_HALF: 2, ARC_HALF: 2 });
});
