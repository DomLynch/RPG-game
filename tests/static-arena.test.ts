import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStaticCameraRig, buildStaticArena, restoreArenaLens, ART1 } from '../src/static-arena.ts';
import { initialState } from '../src/sim.ts';

test('painted ring calibration puts the playable circle inside the artwork floor', () => {
  const camera = new THREE.PerspectiveCamera(51, 1672 / 941);
  const rig = createStaticCameraRig(camera);
  rig.update(1, initialState(), { x: 0, z: 0 }, false, null);
  const centre = new THREE.Vector3(0, 0, 0).project(camera);
  const edge = new THREE.Vector3(8.55, 0, 0).project(camera);
  assert.ok(edge.x > centre.x);
  assert.ok(ART1.floorY > .6 && ART1.floorY < .75);
});

test('fixed angle follows both fighters on portrait and landscape without orbiting', () => {
  for (const aspect of [375 / 812, 812 / 375, 16 / 9]) {
    const camera = new THREE.PerspectiveCamera(51, aspect);
    const rig = createStaticCameraRig(camera);
    const state = { ...initialState(), x: -7, z: 2 };
    rig.orbit(900, 500);
    rig.update(1, state, { x: 7, z: -2 }, true, null);
    for (const point of [new THREE.Vector3(-7, 0, 2), new THREE.Vector3(7, 2.5, -2)]) {
      const screen = point.project(camera);
      assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9, `${aspect}: ${screen.toArray()}`);
    }
    assert.equal(rig.yaw, 0);
    assert.ok(camera.far > camera.position.length());
  }
});

test('trial projection resolves millimetre-separated character surfaces in a 24-bit depth buffer', () => {
  const camera = new THREE.PerspectiveCamera(51, 375 / 812);
  createStaticCameraRig(camera).update(1, initialState(), { x: 0, z: 0 }, true, null);
  const a = new THREE.Vector3(0, 1, 0), b = a.clone().addScaledVector(camera.position.clone().normalize(), .001);
  assert.ok(Math.abs(a.project(camera).z - b.project(camera).z) > 2 / (2 ** 24), 'distinct skin/armour surfaces must not share a depth value');
});


test('a failed first image fetch can be retried and the real floor keeps planar decal UVs', async () => {
  const scene = new THREE.Scene(); let attempts = 0;
  const image = new THREE.Texture<HTMLImageElement>(); image.image = { width: 1672, height: 941 } as HTMLImageElement;
  const arena = buildStaticArena(scene, async () => { if (++attempts === 1) throw new Error('transient network failure'); return image; });
  await assert.rejects(arena.ready, /transient network failure/);
  await arena.ready; await arena.ready;
  assert.equal(attempts, 2, 'only a failed load is retried');
  assert.equal(((arena.group.getObjectByName('painted-arena') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.map!.image as { width: number }).width, 1672);
  const p = arena.floor.geometry.attributes.position, uv = arena.floor.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(p.getY(i)) < 1e-6);
    assert.ok(Math.abs(uv.getX(i) - p.getX(i) / 3) < 1e-6);
    assert.ok(Math.abs(uv.getY(i) - p.getZ(i) / 3) < 1e-6);
  }
  arena.dispose(); assert.equal(scene.children.length, 0);
});

test('portrait and landscape Pit/Gear get a normal lens; returning restores the trial projection', () => {
  for (const aspect of [375 / 812, 812 / 375]) {
    const camera = new THREE.PerspectiveCamera(51, aspect), rig = createStaticCameraRig(camera);
    rig.update(1, initialState(), { x: 0, z: 0 }, true, null);
    restoreArenaLens(camera);
    camera.position.set(0, 2, 5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
    const head = new THREE.Vector3(0, 2.1, 0).project(camera), foot = new THREE.Vector3(0, 0, 0).project(camera);
    assert.ok(Math.abs(head.y) < 1 && Math.abs(foot.y) < 1 && head.z < 1 && foot.z > -1, 'normal-room actor remains in the camera frustum');
    assert.ok(head.y - foot.y > .5, 'room actor is visibly sized');
    rig.update(1, initialState(), { x: 0, z: 0 }, true, null);
    assert.ok(camera.fov < 1 && camera.near > 400);
  }
});
