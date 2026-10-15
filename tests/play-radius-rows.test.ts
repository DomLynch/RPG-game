import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/play-radius-rows.ts';
import { PLAY_SCALE, setPlayScale, spawnScale } from '../src/fight/play-radius.ts';

// play-radius.ts's named numbers are rows (play-radius-defs.json); the values must be exactly the literals the file held before.
test('play-radius rows give exactly the numbers play-radius.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"OPEN_RADIUS": 1000000000.0, "WALL_INNER": 11.7, "BODY_RADIUS": 0.425, "BASE_RADIUS": 8.55, "ARENA_ONE_SCALE": 0.36, "SPAWN_FLOOR": 0.5});
});

// The spawn floor (Lead, 2026-10-14): the fighters start in the same fractions of the circle but never closer than half the full-size start.
test('spawnScale is the play scale, floored at the SPAWN_FLOOR row', () => {
  const outer = PLAY_SCALE;
  try {
    for (const [k, want] of [[1, 1], [0.8, 0.8], [0.36, 0.5], [0.5, 0.5], [0.2, 0.5]] as const) { setPlayScale(k); assert.equal(spawnScale(), want, `scale ${k}`); }
  } finally { setPlayScale(outer); }
});
