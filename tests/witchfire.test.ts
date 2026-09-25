import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFighter, movesOf } from '../src/duel.ts';
import { initialState } from '../src/sim.ts';
import { WITCHFIRE, createWitchfire, witchfireStage } from '../src/witchfire.ts';

// A rig stand-in: an anchor with a left hand 1.2 m up, the fighter at the origin facing +z (heading 0).
function rig() {
  const root = new THREE.Group(), hand = new THREE.Object3D(), trail = new THREE.Mesh(); hand.name = 'hand_l'; hand.position.set(0.2, 1.2, 0.3); trail.name = 'WeaponTrail'; root.add(hand, trail);
  return root;
}
const casting = (age: number) => ({ ...createFighter({ ...initialState(), x: 0, z: 0, heading: 0 }, 'attack'), move: 'skill_witchfire' as const, age });

test('the stage follows the move clock: windup, active, recovery; anything else is none', () => {
  assert.equal(witchfireStage(casting(0)), 'windup');
  assert.equal(witchfireStage(casting(WITCHFIRE.windup - 1)), 'windup');
  assert.equal(witchfireStage(casting(WITCHFIRE.windup)), 'active');
  assert.equal(witchfireStage(casting(WITCHFIRE.windup + WITCHFIRE.active)), 'recovery');
  assert.equal(witchfireStage({ ...casting(10), move: 'heavy_overhead' }), null);
  assert.equal(witchfireStage({ ...casting(10), phase: 'hurt' }), null);   // an interrupted cast shows nothing new
});

test('the palm glows through the windup, the gout fills the cone to the reach, embers follow, and it is green, never orange', () => {
  const scene = new THREE.Scene(), fire = createWitchfire(scene), roots = [rig(), null], idle = createFighter(initialState(), 'ready');
  const glow = scene.getObjectByName('witchfire glow') as THREE.Sprite, points = scene.getObjectByName('witchfire') as THREE.Points;
  const dt = 1 / 60;
  let small = 0;
  for (let age = 0; age < WITCHFIRE.windup; age++) {
    fire.update(dt, [casting(age), idle], roots);
    if (age === 2) small = glow.scale.x;
  }
  assert.deepEqual(fire.glowing(), [true, false]);
  assert.equal(roots[0]!.getObjectByName('WeaponTrail')!.visible, false, 'the borrowed clip\'s weapon trail is hidden through the cast');
  assert.ok(glow.scale.x > small * 2, `the glow grows over the windup (${small.toFixed(2)} → ${glow.scale.x.toFixed(2)})`);
  const before = fire.alive();
  for (let age = WITCHFIRE.windup; age < WITCHFIRE.windup + WITCHFIRE.active; age++) fire.update(dt, [casting(age), idle], roots);
  assert.ok(fire.alive() - before >= 60, `the gout is dense (${fire.alive() - before} new flames)`);
  // Let the gout fly out, then measure how far its front went down the heading (+z from the palm at z 0.3).
  for (let n = 0; n < 12; n++) fire.update(dt, [casting(WITCHFIRE.windup + WITCHFIRE.active + n), idle], roots);
  const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute, size = points.geometry.getAttribute('fireSize') as THREE.BufferAttribute;
  const color = points.geometry.getAttribute('color') as THREE.BufferAttribute;
  let front = 0;
  for (let p = 0; p < pos.count; p++) if (size.getX(p) > 0) {
    front = Math.max(front, pos.getZ(p) - 0.3);
    assert.ok(color.getX(p) <= color.getY(p), `flame ${p} is redder than it is green`);
  }
  // The front must get at least as far as the sim's hit (a gout that stops short reads as a miss that hurts), read from the caster's own
  // weapon table, and not run on far past it.
  const reach = movesOf(casting(0)).skill_witchfire.reach;
  assert.ok(front >= reach && front < reach * 1.6, `the gout's front reaches ${front.toFixed(2)} m against the move's ${reach} m`);
  // The cast ends: nothing new is born, and what is in the air burns out within a second.
  for (let n = 0; n < 90; n++) fire.update(dt, [idle, idle], roots);
  assert.equal(fire.alive(), 0); assert.deepEqual(fire.glowing(), [false, false]); assert.equal(points.visible, false);
});

test('a hit-stop (dt 0, the age held) holds the flames and adds none', () => {
  const scene = new THREE.Scene(), fire = createWitchfire(scene), roots = [rig(), null], idle = createFighter(initialState(), 'ready');
  fire.update(1 / 60, [casting(WITCHFIRE.windup), idle], roots);
  const n = fire.alive();
  for (let k = 0; k < 5; k++) fire.update(0, [casting(WITCHFIRE.windup), idle], roots);
  assert.equal(fire.alive(), n);
});

test('the weapon trail is hidden only for the cast: a plain heavy keeps it', () => {
  const scene = new THREE.Scene(), fire = createWitchfire(scene), roots = [rig(), null], idle = createFighter(initialState(), 'ready');
  const trail = roots[0]!.getObjectByName('WeaponTrail')!;
  trail.visible = true;   // what characters.ts sets near a swing's contact
  fire.update(1 / 60, [{ ...casting(20), move: 'heavy_overhead' }, idle], roots);
  assert.equal(trail.visible, true, 'a heavy swing keeps its trail');
  fire.update(1 / 60, [casting(20), idle], roots);
  assert.equal(trail.visible, false, 'the Witch-fire cast hides it');
});
