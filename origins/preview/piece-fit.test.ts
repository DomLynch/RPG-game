import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { boneRatios, fitPieces } from './piece-fit.ts';

// A three-bone chain along +Y (root, spine at 1 m, head at 2 m), scaled by `k` for the bigger body.
const chain = (k: number, spine = 1): THREE.Skeleton => {
  const root = new THREE.Bone(), a = new THREE.Bone(), b = new THREE.Bone(); root.name = 'root'; a.name = 'spine'; b.name = 'head';
  root.add(a); a.add(b); a.position.y = spine * k; b.position.y = 1 * k; root.updateMatrixWorld(true);
  return new THREE.Skeleton([root, a, b]);
};

test('the ratio per bone is the body segment over the hero segment (a uniform 2x body gives 2 everywhere a segment exists, 1 for the root)', () => {
  const r = boneRatios(chain(1), chain(2));
  assert.equal(r.get('root'), 1); assert.ok(Math.abs(r.get('spine')! - 2) < 1e-6); assert.ok(Math.abs(r.get('head')! - 2) < 1e-6);
});

test('per bone, not one number: a body whose spine is 3x but head segment 1.5x gets each', () => {
  const hero = chain(1), body = chain(1); body.bones[1]!.position.y = 3; body.bones[2]!.position.y = 1.5; body.bones[0]!.updateMatrixWorld(true);
  const rig = new THREE.Skeleton(body.bones);
  const r = boneRatios(hero, rig);
  assert.ok(Math.abs(r.get('spine')! - 3) < 1e-6); assert.ok(Math.abs(r.get('head')! - 1.5) < 1e-6);
});

test('the ratio stays inside the rows limits (a collapsed or exploded body never drives a piece to nothing or to the horizon)', () => {
  const huge = boneRatios(chain(1), chain(1000)), tiny = boneRatios(chain(1), chain(0.001));
  assert.ok(huge.get('spine')! <= 3 + 1e-9, `got ${huge.get('spine')}`); assert.ok(tiny.get('spine')! >= 0.5 - 1e-9, `got ${tiny.get('spine')}`);
});

test('fitPieces scales the piece\'s inverse binds by the bone ratio and leaves the original piece and geometry untouched', () => {
  const hero = chain(1), rig = chain(2), geometry = new THREE.BufferGeometry(), material = new THREE.MeshBasicMaterial();
  const piece = new THREE.SkinnedMesh(geometry, material); piece.bind(hero);
  const before = hero.boneInverses.map((m) => m.clone());
  const [fitted] = fitPieces([piece], rig);
  assert.notEqual(fitted, piece); assert.equal(fitted!.geometry, geometry); assert.equal(fitted!.material, material);
  hero.boneInverses.forEach((m, i) => assert.ok(m.equals(before[i]!), 'the source skeleton is untouched'));
  const spine = fitted!.skeleton.boneInverses[1]!, expected = new THREE.Matrix4().makeScale(2, 2, 2).multiply(hero.boneInverses[1]!);
  assert.ok(spine.equals(expected) || spine.elements.every((e, k) => Math.abs(e - expected.elements[k]!) < 1e-6));
  const [a, b] = fitPieces([piece, piece], rig); assert.equal(a!.skeleton, b!.skeleton, 'pieces on one source skeleton share one fitted skeleton');
});
