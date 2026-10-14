import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/play-radius-rows.ts';

// play-radius.ts's named numbers are rows (play-radius-defs.json); the values must be exactly the literals the file held before.
test('play-radius rows give exactly the numbers play-radius.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"OPEN_RADIUS": 1000000000.0, "WALL_INNER": 11.7, "BODY_RADIUS": 0.425, "BASE_RADIUS": 8.55, "ARENA_ONE_SCALE": 0.36});
});
