// The Pit's prop loader (src/pit-prop.ts): what scene.ts hands the room for a prop. A 404, a bad file or maps that never decode give null
// (the room leaves the spot bare, tests/pit-room.test.ts) and a report; a dropped connection or a first bare decode is retried.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadPitExtra, loadPitProp } from '../src/pit-prop.ts';
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

// An extra keeps the file's whole node tree: names, and the full rest pose (translation, rotation, scale), over the file's own geometry and material.
const tree = (albedo: boolean) => {
  const scene = new THREE.Group(), material = new THREE.MeshStandardMaterial({ map: albedo ? map() : null });
  for (const [name, y] of [['Drum', 2.89], ['Counterweight', 1.78]] as const) {
    const node = new THREE.Mesh(new THREE.BoxGeometry(), material); node.name = name; node.position.set(0.5, y, 0.08); node.rotation.set(0.3, 0, 0); node.scale.set(1, 2, 1); scene.add(node);
  }
  return { scene };
};
test('an extra: every node comes back by name with its whole rest pose, sharing the file\'s geometry and material', async () => {
  const loaded = tree(true), reports: unknown[] = [];
  const out = await loadPitExtra('pit/extra/gate-machinery.glb', async () => loaded, (e) => reports.push(e), noSleep);
  assert.ok(out);
  const drum = out.getObjectByName('Drum') as THREE.Mesh, source = loaded.scene.getObjectByName('Drum') as THREE.Mesh;
  assert.ok(drum !== source && drum.geometry === source.geometry && drum.material === source.material, 'a copy over the shared geometry and material');
  assert.deepEqual(drum.position.toArray(), [0.5, 2.89, 0.08]); assert.deepEqual(drum.scale.toArray(), [1, 2, 1]); assert.ok(Math.abs(drum.rotation.x - 0.3) < 1e-9, 'rotation kept');
  assert.deepEqual(reports, []);
});
test('an extra with no mesh, a 404, or an albedo map that never decodes: null, reported (the retry covers a dropped connection and a bare first decode)', async () => {
  const reports: unknown[] = []; let calls = 0;
  assert.equal(await loadPitExtra('u', async () => ({ scene: new THREE.Group() }), (e) => reports.push(e), noSleep), null);
  assert.equal(await loadPitExtra('u', () => Promise.reject(new Error('404')), (e) => reports.push(e), noSleep), null);
  assert.equal(await loadPitExtra('u', async () => { calls++; return tree(false); }, (e) => reports.push(e), noSleep), null);
  assert.equal(calls, 3, 'a map missing is retried like a prop');
  assert.equal(reports.length, 3);
  const flaky = await loadPitExtra('u', async () => tree(++calls > 4), () => {}, noSleep);
  assert.ok(flaky, 'bare once, then whole: mounted');
});
