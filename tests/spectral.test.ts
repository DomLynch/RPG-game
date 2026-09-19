import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, SkinnedMesh, BufferGeometry, MeshStandardMaterial, Points } from 'three';
import { spectralAppearance } from '../src/spectral.ts';

test('only Wraith gets a private transparent material; death fades and rematch restores it', () => {
  const root = new Group(), shared = new MeshStandardMaterial(), body = new SkinnedMesh(new BufferGeometry(), shared);
  body.name = 'CreatureBody'; root.add(body);
  body.userData.creature = 'minotaur'; assert.equal(spectralAppearance(root), undefined);
  assert.equal(body.material, shared); assert.equal(root.children.length, 1);
  body.userData.creature = 'wraith'; const update = spectralAppearance(root)!;
  assert.notEqual(body.material, shared); assert.equal(shared.transparent, false);
  assert.equal(body.material.transparent, true); assert.equal(body.material.depthWrite, false);
  assert.equal(body.castShadow, false);
  assert.equal((root.children.find(o => o instanceof Points) as Points).geometry.attributes.position.count, 28);
  update(1 / 60, true, 1); assert.equal(body.material.opacity, 0);
  update(1 / 60, false, 0); assert.equal(body.material.opacity, .86);
  update(0, true, .5); assert(body.material.opacity > 0 && body.material.opacity < .86);
});
