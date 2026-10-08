import test from 'node:test';
import assert from 'node:assert/strict';
import { aim, distance, idleIntent, initialDuel, stepDuel } from '../src/duel.ts';
import { initialState, initialTarget } from '../src/sim.ts';
import { OPPONENTS } from '../src/moves.ts';
import { initialPractice } from '../src/combat.ts';

const marks = { hero: { x: initialState().x, z: initialState().z }, foe: { x: initialTarget().x, z: initialTarget().z }, heroFacing: initialState().heading };

test('no pose is today\'s pit marks, and a pose AT the marks is the same fight tick for tick', () => {
  const plain = initialDuel(OPPONENTS.pitborn), posed = initialDuel(OPPONENTS.pitborn, 'longsword', null, marks);
  assert.deepEqual(plain.fighters[0].body, { x: 0, z: initialState().z, heading: Math.PI, distance: 0 });
  assert.deepEqual(posed, plain);
  let a = plain, b = posed;
  for (let t = 0; t < 120; t++) { a = stepDuel(a, [{ ...idleIntent(), action: t === 3 ? 'light' : undefined }, idleIntent()] as never); b = stepDuel(b, [{ ...idleIntent(), action: t === 3 ? 'light' : undefined }, idleIntent()] as never); }
  assert.deepEqual(b, a);
});

test('a world pose keeps the distance and the facing: the foe faces the hero, the hero faces where it was told', () => {
  const pose = { hero: { x: -2, z: 1 }, foe: { x: 1.5, z: -1 }, heroFacing: 0 };
  const d = initialDuel(OPPONENTS.veteran, 'longsword', null, pose), [h, f] = d.fighters;
  assert.ok(Math.abs(distance(h.body, f.body) - Math.hypot(3.5, 2)) < 1e-12);
  assert.equal(h.body.heading, 0); assert.ok(Math.abs(Math.abs(f.body.heading) - Math.PI) < 1e-12);
  const toFoe = aim(h.body, f.body);
  const facing = { ...pose, heroFacing: toFoe }, e = initialDuel(OPPONENTS.veteran, 'longsword', null, facing).fighters;
  assert.ok(Math.abs(aim(e[1].body, e[0].body) - e[1].body.heading) < 1e-9, 'facing each other: the foe\'s heading is the aim at the hero');
  assert.equal(initialPractice(5, OPPONENTS.veteran, 'longsword', null, undefined, undefined, undefined, pose).duel.fighters[0].body.x, -2);
});

test('a pose outside the wall, with a non-finite number or with the bodies overlapping throws instead of clamping', () => {
  const ok = { hero: { x: -2, z: 0 }, foe: { x: 2, z: 0 }, heroFacing: 0 };
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { ...ok, hero: { x: 99, z: 0 } }), /inside the wall/);
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { ...ok, foe: { x: NaN, z: 0 } }), /inside the wall/);
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { ...ok, heroFacing: Infinity }), /finite/);
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { hero: { x: 0, z: 0 }, foe: { x: .3, z: 0 }, heroFacing: 0 }), /inside each other/);
});
