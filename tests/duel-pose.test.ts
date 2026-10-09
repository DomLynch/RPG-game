import test from 'node:test';
import assert from 'node:assert/strict';
import { aim, distance, initialDuel, roundPose } from '../src/duel.ts';
import { initialState, initialTarget } from '../src/sim.ts';
import { OPPONENTS } from '../src/moves.ts';
import { initialPractice } from '../src/combat.ts';

const marks = { hero: { x: initialState().x, z: initialState().z }, foe: { x: initialTarget().x, z: initialTarget().z }, heroFacing: initialState().heading };

test('no pose is today\'s pit marks byte for byte; a pose AT the marks differs only by float32 rounding of the facing', () => {
  const plain = initialDuel(OPPONENTS.pitborn), posed = initialDuel(OPPONENTS.pitborn, 'longsword', null, marks);
  assert.deepEqual(plain.fighters[0].body, { x: 0, z: initialState().z, heading: Math.PI, distance: 0 });
  assert.deepEqual(plain.fighters[1].body, { x: 0, z: initialTarget().z, heading: 0, distance: 0 });
  assert.deepEqual(posed.fighters[1].body, plain.fighters[1].body, 'the foe at its mark faces the hero exactly as before');
  assert.ok(Math.abs(Math.abs(posed.fighters[0].body.heading) - Math.PI) < 1e-6, 'the hero\'s pi becomes its float32 neighbour (wrapped), nothing else moves');
  assert.equal(posed.fighters[0].body.z, plain.fighters[0].body.z);
});

test('a world pose keeps the distance and the facing: the foe faces the hero, the hero faces where it was told', () => {
  const pose = { hero: { x: -2, z: 1 }, foe: { x: 1.5, z: -1 }, heroFacing: 0 };
  const d = initialDuel(OPPONENTS.veteran, 'longsword', null, pose), [h, f] = d.fighters;
  assert.ok(Math.abs(distance(h.body, f.body) - Math.hypot(3.5, 2)) < 1e-12);
  assert.equal(h.body.heading, 0);   // the hero keeps the facing it was given
  assert.ok(Math.abs(f.body.heading - aim(f.body, h.body)) < 1e-12, 'the foe faces the hero from where it stands, whatever heroFacing says');
  const toFoe = aim(h.body, f.body);
  const facing = { ...pose, heroFacing: toFoe }, e = initialDuel(OPPONENTS.veteran, 'longsword', null, facing).fighters;
  assert.ok(Math.abs(aim(e[1].body, e[0].body) - e[1].body.heading) < 1e-9, 'facing each other: the foe\'s heading is the aim at the hero');
  assert.equal(initialPractice(5, OPPONENTS.veteran, 'longsword', null, undefined, undefined, undefined, pose).duel.fighters[0].body.x, -2);
});

test('an off-aim heroFacing cannot turn the foe away: its heading is the aim at the hero', () => {
  const off = { hero: { x: -2, z: 1 }, foe: { x: 1.5, z: -1 }, heroFacing: 2.5 }, [h, f] = initialDuel(OPPONENTS.veteran, 'longsword', null, off).fighters;
  assert.ok(Math.abs(f.body.heading - aim(f.body, h.body)) < 1e-12); assert.equal(h.body.heading, Math.fround(2.5));
});

test('an unrounded pose starts the same fight as its float32 rounding (live and replay begin from the same bits)', () => {
  const raw = { hero: { x: -2.3, z: 1.1 }, foe: { x: 1.7, z: -0.9 }, heroFacing: 0.6 };
  assert.deepEqual(initialDuel(OPPONENTS.veteran, 'longsword', null, raw), initialDuel(OPPONENTS.veteran, 'longsword', null, roundPose(raw)));
});

test('a pose outside the wall, with a non-finite number or with the bodies overlapping throws instead of clamping', () => {
  const ok = { hero: { x: -2, z: 0 }, foe: { x: 2, z: 0 }, heroFacing: 0 };
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { ...ok, hero: { x: 99, z: 0 } }), /inside the wall/);
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { ...ok, foe: { x: NaN, z: 0 } }), /inside the wall/);
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { ...ok, heroFacing: Infinity }), /finite/);
  assert.throws(() => initialDuel(OPPONENTS.veteran, 'longsword', null, { hero: { x: 0, z: 0 }, foe: { x: .3, z: 0 }, heroFacing: 0 }), /inside each other/);
});
