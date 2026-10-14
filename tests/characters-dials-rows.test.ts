import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/characters-dials-rows.ts';

// characters-dials.ts's named numbers are rows (characters-dials-defs.json); the values must be exactly the literals the file held before.
test('characters-dials rows give exactly the numbers characters-dials.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"DEFLECT_FROM": 0.35});
});
