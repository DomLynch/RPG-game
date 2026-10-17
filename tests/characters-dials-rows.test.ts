import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/characters-dials-rows.ts';

// characters-dials.ts's named numbers are rows (characters-dials-defs.json); the values must be exactly the literals the file held before.
test('characters-dials rows give exactly the numbers characters-dials.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"DEFLECT_FROM": 0.35, "STEP_MAX": 0.1, "WALK_RATE_FLOOR": 0.25, "RUN_RATE_FLOOR": 0.5, "CLIP_END": 0.999999, "RADIUS_MIN": 0.07, "RADIUS_MAX": 0.24, "ARM_REACH_MIN": 0.03});   // the clamp literals characters.ts held inline (as-data check (e)), bit for bit
});
