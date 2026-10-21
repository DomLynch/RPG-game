import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { enableCasters, limitCasters } from '../origins/preview/shadow-casters.ts';

const mesh = (cast: boolean) => { const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); m.castShadow = cast; return m; };

test('limitCasters turns every caster off except the kept subtree, and is idempotent', () => {
  const scene = new THREE.Scene(), hero = new THREE.Group(), prop = mesh(true), creaturePiece = mesh(true), heroBody = mesh(true), heroPiece = mesh(true);
  const creature = new THREE.Group(); creature.add(creaturePiece); hero.add(heroBody); heroBody.add(heroPiece);
  scene.add(hero, prop, creature);
  assert.equal(limitCasters(scene, hero), 2, 'the prop and the creature piece stop casting');
  assert.deepEqual([prop, creaturePiece].map((m) => m.castShadow), [false, false]);
  assert.deepEqual([heroBody, heroPiece].map((m) => m.castShadow), [true, true], 'the hero keeps every caster he has');
  assert.equal(limitCasters(scene, hero), 0, 'a second pass finds nothing to do');
});

test('limitCasters keeps several subtrees, and enableCasters turns a kept creature on', () => {
  const scene = new THREE.Scene(), hero = new THREE.Group(), near = new THREE.Group(), far = new THREE.Group(), a = mesh(true), b = mesh(false), c = mesh(true);
  hero.add(a); near.add(b); far.add(c); scene.add(hero, near, far);
  assert.equal(limitCasters(scene, [hero, near]), 1, 'only the far creature stops casting');
  enableCasters([near]);
  assert.deepEqual([a, b, c].map((m) => m.castShadow), [true, true, false], 'the near creature, which defaulted to off, now casts');
});

test('with no hero yet, every caster is limited; a mesh that never cast is not counted', () => {
  const scene = new THREE.Scene(), a = mesh(true), b = mesh(false); scene.add(a, b);
  assert.equal(limitCasters(scene, null), 1);
  assert.equal(a.castShadow, false);
});
