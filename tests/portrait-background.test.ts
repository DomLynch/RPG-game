import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addPortraitBackground } from '../src/portrait-background.ts';
import type { Arena } from '../src/arena.ts';

test('background cover crops only the picture; floor geometry and original environment survive', async () => {
  const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial()); group.add(floor);
  const sky = new THREE.Texture(); let disposed = false;
  const mat = floor.material;
  const base: Arena = { group, floor, sky, materials: { sand: mat, stone: mat, iron: mat, cloth: mat, coal: mat }, ready: Promise.resolve(), update() {}, raiseGate() {}, guards: { built: 0, of: 0 }, dispose() { disposed = true; scene.remove(group); } };
  let attempts = 0; const loaded = new THREE.Texture();
  const arena = addPortraitBackground(scene, base, async () => { if (++attempts === 1) throw new Error('offline'); return loaded; });
  await assert.rejects(arena.ready, /offline/); await arena.ready; await arena.ready;
  assert.equal(attempts, 2); assert.equal(arena.sky, sky);
  assert.equal(arena.floor.geometry, floor.geometry); assert.equal(arena.floor.geometry.attributes.uv, floor.geometry.attributes.uv);
  assert.equal(group.visible, false); assert.equal(arena.floor.receiveShadow, true);
  const image = arena.group.getObjectByName('portrait-background') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  for (const [w, h] of [[375, 812], [812, 375], [941, 1672]]) {
    arena.resize(w, h);
    const texture = image.material.map!;
    assert.ok(texture.repeat.x > 0 && texture.repeat.x <= 1); assert.ok(texture.repeat.y > 0 && texture.repeat.y <= 1);
    assert.ok(Math.abs((941 / 1672) * texture.repeat.x / texture.repeat.y - w / h) < 1e-12, 'cropped image retains its aspect rather than stretching');
    assert.ok(Math.abs(Math.max(texture.repeat.x, texture.repeat.y) - .5) < 1e-12, 'the floor-focused crop fills the canvas');
  }
  assert.equal(image.material.toneMapped, false); assert.equal(image.material.fog, false); assert.equal(image.material.depthTest, false);
  const parent = arena.group; arena.dispose(); assert.equal(disposed, true); assert.equal(parent.parent, null);
});
