import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_ONE_SCALE, BASE_RADIUS, BODY_RADIUS, FIRST_SCALED_VERSION, WALL_INNER, ARENA_ONE, PLAY_SCALE, RADIUS, playScaleFor, setPlayScale } from '../src/play-radius.ts';
import { underRecord } from '../src/detmath.ts';
import { LADDER } from '../src/ladder.ts';
import { ARENA_PICK, arenaBand, arenaFor, ARENA_THEMES } from '../src/arena-themes.ts';
import { RECORD_VERSION, createRecorder, packRecord, unpackRecord } from '../src/record.ts';

test('the scaled opponents are exactly the ladder rungs that fight in Arena 1', () => {
  const arenaOne = LADDER.filter((_, i) => ARENA_PICK[arenaBand(i + 1)] === '1').map(o => o.id);
  assert.deepEqual(arenaOne, ['veteran', 'pitborn']);
  assert.deepEqual([...ARENA_ONE], arenaOne, 'an inclusion list: Arena 1 only');
  for (const o of LADDER) assert.equal(arenaFor(o.id) === ARENA_THEMES['1'], playScaleFor(o.id, RECORD_VERSION) !== 1, `${o.id}: the circle comes inward exactly where the arena is Arena 1`);
});

test('only a version-23 fight in Arena 1 is fought in the smaller circle (0.36); every older record keeps the old one', () => {
  assert.equal(FIRST_SCALED_VERSION, 23);
  assert.equal(playScaleFor('veteran', 23), ARENA_ONE_SCALE);
  assert.equal(playScaleFor('pitborn', 23), ARENA_ONE_SCALE);
  assert.equal(playScaleFor('veteran', 22), 1);
  assert.equal(playScaleFor('goblin', 23), 1);
  assert.equal(playScaleFor('somebody-new', 23), 1, 'an unknown or new opponent keeps the old circle (fails closed)');
  assert.equal(playScaleFor('shieldmaiden', 23), 1);
});

test('underRecord steps a record in its own circle and puts the live one back', () => {
  setPlayScale(ARENA_ONE_SCALE);
  assert.equal(RADIUS, WALL_INNER * ARENA_ONE_SCALE - BODY_RADIUS);
  underRecord({ v: 22, opponent: 'veteran' }, () => { assert.equal(RADIUS, BASE_RADIUS); assert.equal(PLAY_SCALE, 1); });
  underRecord({ v: 23, opponent: 'veteran' }, () => assert.equal(RADIUS, WALL_INNER * ARENA_ONE_SCALE - BODY_RADIUS));
  underRecord({ v: 23, opponent: 'goblin' }, () => assert.equal(RADIUS, BASE_RADIUS));
  assert.equal(RADIUS, WALL_INNER * ARENA_ONE_SCALE - BODY_RADIUS, 'restored');
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

test('a record states the circle its fight was fought in: this build\'s version in the live circle, the old-circle version otherwise, and both round-trip', () => {
  const stamp = (opponent: 'veteran' | 'goblin') => { const rec = createRecorder({ weapon: 'longsword', build: 'x', opponent, level: 18, seed: 1 }); rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }); const r = rec.finish('abandoned'); assert.deepEqual(unpackRecord(packRecord(r)), r); return r.v; };
  setPlayScale(ARENA_ONE_SCALE); assert.equal(stamp('veteran'), RECORD_VERSION); assert.equal(stamp('goblin'), FIRST_SCALED_VERSION - 1, 'a goblin fought in the small circle was not fought in his own');
  setPlayScale(1); assert.equal(stamp('veteran'), FIRST_SCALED_VERSION - 1, 'a veteran fought in the old circle is an old-circle record'); assert.equal(stamp('goblin'), RECORD_VERSION);
});

test('in Arena 1 the wall is the boundary: the play circle ends at the wall\'s inner face less a body radius, in the arena\'s own drawn size', async () => {
  const { LAYOUT } = await import('../src/arena.ts');
  assert.equal(WALL_INNER, LAYOUT.wall.inner, 'the pinned copy of the wall radius');
  setPlayScale(ARENA_ONE_SCALE);
  assert.ok(Math.abs(RADIUS - (LAYOUT.wall.inner * ARENA_ONE_SCALE - BODY_RADIUS)) < 1e-12);
  assert.ok(RADIUS > BASE_RADIUS * ARENA_ONE_SCALE && RADIUS < LAYOUT.wall.inner * ARENA_ONE_SCALE, `${RADIUS.toFixed(3)} m: past the old inner ring, short of the wall`);
  setPlayScale(1); assert.equal(RADIUS, BASE_RADIUS);
});
