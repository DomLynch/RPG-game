import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_ONE_SCALE, BASE_RADIUS, FIRST_SCALED_VERSION, OTHER_ARENAS, PLAY_SCALE, RADIUS, playScaleFor, setPlayScale } from '../src/play-radius.ts';
import { underRecord } from '../src/detmath.ts';
import { LADDER } from '../src/ladder.ts';
import { ARENA_PICK, arenaBand, arenaFor, ARENA_THEMES } from '../src/arena-themes.ts';
import { RECORD_VERSION } from '../src/record.ts';

test('the scaled opponents are exactly the ladder rungs that fight in Arena 1', () => {
  const arenaOne = LADDER.filter((o, i) => ARENA_PICK[arenaBand(i + 1)] === '1').map(o => o.id);
  assert.deepEqual(arenaOne, ['veteran', 'pitborn']);
  for (const o of LADDER) assert.equal(OTHER_ARENAS.includes(o.id), !arenaOne.includes(o.id), o.id);
  for (const o of LADDER) assert.equal(arenaFor(o.id) === ARENA_THEMES['1'], playScaleFor(o.id, RECORD_VERSION) !== 1, `${o.id}: the circle comes inward exactly where the arena is Arena 1`);
});

test('only a version-23 fight in Arena 1 is fought in the smaller circle (0.36); every older record keeps the old one', () => {
  assert.equal(FIRST_SCALED_VERSION, 23);
  assert.equal(playScaleFor('veteran', 23), ARENA_ONE_SCALE);
  assert.equal(playScaleFor('pitborn', 23), ARENA_ONE_SCALE);
  assert.equal(playScaleFor('veteran', 22), 1);
  assert.equal(playScaleFor('goblin', 23), 1);
  assert.equal(playScaleFor('shieldmaiden', 23), 1);
});

test('underRecord steps a record in its own circle and puts the live one back', () => {
  setPlayScale(ARENA_ONE_SCALE);
  assert.equal(RADIUS, BASE_RADIUS * ARENA_ONE_SCALE);
  underRecord({ v: 22, opponent: 'veteran' }, () => { assert.equal(RADIUS, BASE_RADIUS); assert.equal(PLAY_SCALE, 1); });
  underRecord({ v: 23, opponent: 'veteran' }, () => assert.equal(RADIUS, BASE_RADIUS * ARENA_ONE_SCALE));
  underRecord({ v: 23, opponent: 'goblin' }, () => assert.equal(RADIUS, BASE_RADIUS));
  assert.equal(RADIUS, BASE_RADIUS * ARENA_ONE_SCALE, 'restored');
  setPlayScale(1);
});

test('fighters start inside the smaller circle, shrunk with it but never closer than half of the old start', async () => {
  const { initialState, initialTarget } = await import('../src/sim.ts');
  setPlayScale(1); assert.deepEqual([initialState().z, initialTarget().z], [4, -2.5]);
  setPlayScale(ARENA_ONE_SCALE);
  const [p, t] = [initialState(), initialTarget()];
  assert.deepEqual([p.z, t.z], [2, -1.25]);
  assert.ok(Math.hypot(p.x, p.z) < RADIUS && Math.hypot(t.x, t.z) < RADIUS && p.z - t.z >= 3);
  setPlayScale(1);
});
