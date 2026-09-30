// The Pit's prop loader (src/pit-prop.ts): what scene.ts hands the room for a prop. A 404, a bad file or maps that never decode give null
// (the room leaves the spot bare, tests/pit-room.test.ts) and a report; a dropped connection or a first bare decode is retried.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadPitProp } from '../src/pit-prop.ts';
import { MissingTextures } from '../src/retry.ts';

const map = () => new THREE.Texture();
const gltf = (maps: Partial<Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture | null>>) => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(maps)));
  return { scene };
};
const FULL = () => gltf({ map: map(), normalMap: map(), roughnessMap: map() });
const noSleep = async () => {};
const run = async (loads: (() => Promise<{ scene: THREE.Object3D }>)[]) => {
  const reports: unknown[] = []; let calls = 0;
  const mesh = await loadPitProp('pit/props/rack.glb', () => loads[Math.min(calls++, loads.length - 1)]!(), (e) => reports.push(e), noSleep);
  return { mesh, reports, calls };
};

test('a prop that loads with its three maps: its first mesh, one load, nothing reported', async () => {
  const { mesh, reports, calls } = await run([async () => FULL()]);
  assert.ok(mesh instanceof THREE.Mesh);
  assert.equal(calls, 1);
  assert.deepEqual(reports, []);
});

test('a 404 or a bad file: null at once (no retry), and the failure is reported, not swallowed', async () => {
  const error = new Error('fetch for "pit/props/rack.glb" responded with 404: Not Found');
  const { mesh, reports, calls } = await run([() => Promise.reject(error)]);
  assert.equal(mesh, null);
  assert.equal(calls, 1);
  assert.deepEqual(reports, [error]);
});

test('an embedded map that failed to decode (GLTFLoader leaves it null, FRANKENDOM-5): the load is retried, never mounted bare', async () => {
  for (const missing of ['map', 'normalMap', 'roughnessMap'] as const) {
    const bare = async () => gltf({ map: map(), normalMap: map(), roughnessMap: map(), [missing]: null });
    const healed = await run([bare, async () => FULL()]);
    assert.ok(healed.mesh instanceof THREE.Mesh && (healed.mesh.material as THREE.MeshStandardMaterial)[missing], `${missing}: the second load's textured mesh`);
    assert.equal(healed.calls, 2);
    assert.deepEqual(healed.reports, []);
    const never = await run([bare]);
    assert.equal(never.mesh, null, `${missing}: three bare loads give a bare spot, not an untextured prop`);
    assert.equal(never.calls, 3);
    assert.ok(never.reports.length === 1 && never.reports[0] instanceof MissingTextures && (never.reports[0] as MissingTextures).missing === missing);
  }
});

test('a dropped connection is retried; a file with no mesh is null and reported', async () => {
  const dropped = await run([() => Promise.reject(new TypeError('Load failed')), async () => FULL()]);
  assert.ok(dropped.mesh instanceof THREE.Mesh);
  assert.equal(dropped.calls, 2);
  const empty = await run([async () => ({ scene: new THREE.Group() })]);
  assert.equal(empty.mesh, null);
  assert.equal(empty.reports.length, 1);
});
