// The Giant Salamander's fire breath (Dom 2026-10-16): the row is the switch, the jet runs from the mouth toward the hero within its reach, and it ends by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { breathes, createBreath } from '../src/fight/breath.ts';
import { fxNum } from '../src/fight/fx-rows.ts';

test('only a creature with a breath row breathes', () => {
  assert.equal(breathes('giant-salamander'), true);
  for (const id of ['ash-wolf', 'wolf', 'boar', 'cave-troll', 'goblin']) assert.equal(breathes(id), false, id);
});

test('a breath draws puffs between the mouth and the hero, never past its reach, and ends', () => {
  const scene = new THREE.Scene(), breath = createBreath(scene), mouth = new THREE.Vector3(0, 1, 0), chest = new THREE.Vector3(0, 1, 3);
  breath.start('s1', mouth, chest, 7);
  assert.equal(breath.active(), 1);
  for (let k = 0; k < 20; k++) breath.update(0.02);
  const sprites = (scene.children[0] as THREE.Group).children as THREE.Sprite[], shown = sprites.filter((s) => s.visible);
  assert.ok(shown.length > 0, 'puffs are showing');
  assert.ok(shown.every((s) => s.position.z >= -1e-9 && s.position.z <= fxNum('breath.range') + 1e-6), 'every puff stays on the line out of the mouth, within the stream\'s reach');
  assert.ok(shown.every((s) => (s.material as THREE.SpriteMaterial).opacity <= fxNum('breath.opacity') + 1e-9), 'no puff is brighter than the row\'s opacity');
  breath.start('s1', mouth, chest, 7);
  assert.equal(breath.active(), 1, 'a restart replaces the jet');
  for (let k = 0; k < Math.ceil((fxNum('breath.life') + 1) / 0.05); k++) breath.update(0.05);
  assert.equal(breath.active(), 0, 'the jet is gone when its life is over');
  assert.equal(scene.children.length, 0, 'and so are its sprites');
});
