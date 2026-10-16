// The Giant Salamander's fire breath (Dom 2026-10-16/17): the row is the switch, the stream runs from the mouth along the line to the hero within its reach, shows separate tongues, and ends by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { breathes, createBreath } from '../src/fight/breath.ts';
import { fxNum } from '../src/fight/fx-rows.ts';

test('only a creature with a breath row breathes', () => {
  assert.equal(breathes('giant-salamander'), true);
  for (const id of ['ash-wolf', 'wolf', 'boar', 'cave-troll', 'goblin']) assert.equal(breathes(id), false, id);
});

test('a breath draws separate tongues out of the mouth, never past its reach, then smoke and embers, and ends', () => {
  const scene = new THREE.Scene(), breath = createBreath(scene), mouth = new THREE.Vector3(0, 1, 0), chest = new THREE.Vector3(0, 1, 3);
  breath.start('s1', mouth, chest, 7);
  assert.equal(breath.active(), 1);
  for (let k = 0; k < 40; k++) breath.update(0.02);
  const group = scene.children[0] as THREE.Group, tongues = group.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
  assert.equal(tongues.count, fxNum('breath.tongues'));
  const lives = (tongues.geometry.getAttribute('aLife') as THREE.BufferAttribute).array as Float32Array, m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
  const showing = [...Array(tongues.count).keys()].filter((k) => { tongues.getMatrixAt(k, m); m.decompose(p, q, s); return s.x > 0; });
  assert.ok(showing.length >= 2 && showing.length < tongues.count, `separate tongues are showing, not one beam or all at once: ${showing.length}`);
  assert.ok(showing.every((k) => { tongues.getMatrixAt(k, m); m.decompose(p, q, s); return p.z >= -0.5 && p.z <= fxNum('breath.range') + 1e-6 && lives[k]! >= 0 && lives[k]! <= 1; }), 'every tongue is on the stream within its reach and has a life in 0..1');
  breath.start('s1', mouth, chest, 7);
  assert.equal(breath.active(), 1, 'a restart replaces the jet');
  for (let k = 0; k < Math.ceil((fxNum('breath.life') + 1.5) / 0.05); k++) breath.update(0.05);
  assert.equal(breath.active(), 0, 'the jet is gone when its life is over');
  assert.equal(scene.children.length, 0, 'and so are its parts');
});
