import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { kitGroup, updateKitViews, type KitLod } from './frontier-kit-view.ts';

// The kit's far bodies (building-skins.json `lod: { url, dist }`, Characters): a kind with a far body draws the full mesh within `dist` metres of the camera and the far mesh beyond, and its shadow proxy casts the far geometry.
const rootOf = (...names: string[]) => { const g = new THREE.Group(); for (const n of names) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); m.name = n; g.add(m); } return g; };
const at = (node: string, ...xs: number[]) => xs.map((x, i) => ({ node, x, z: 0, rotY: i * 0.3, scale: 1 }));
const farGeometry = new THREE.OctahedronGeometry(1), farMaterial = new THREE.MeshStandardMaterial();
const lods = (dist: number): ReadonlyMap<string, KitLod> => new Map([['goblin_hut', { geometry: farGeometry, material: farMaterial, dist }]]);
const kids = (g: THREE.Group, n: string) => g.children.find((c) => c.name === n) as THREE.InstancedMesh | undefined;

test('near and far are bucketed by distance to the eye; every instance is drawn exactly once', () => {
  const g = kitGroup(rootOf('goblin_hut', 'tree_a'), { placements: [...at('goblin_hut', 0, 10, 20, 40, 80), ...at('tree_a', 0, 10)], landmarks: [] } as never, () => 0, { lods: lods(15), override: {} });
  const near = kids(g, 'goblin_hut')!, far = kids(g, 'goblin_hut__far')!;
  assert.ok(far, 'a kind with a far body gets a far mesh'); assert.equal(far.geometry, farGeometry); assert.equal(kids(g, 'tree_a__far'), undefined, 'a kind without one does not');
  updateKitViews({ x: 0, z: 0 }, 1);
  assert.equal(near.count, 2, 'x = 0 and 10 are within 15 m'); assert.equal(far.count, 3, 'x = 20, 40 and 80 are within the 100 m draw row but beyond 15 m');
  assert.equal(near.count + far.count, 5);
  updateKitViews({ x: 40, z: 0 }, 1, { x: 30, z: 0 });   // the walker moved; the eye is behind him (the camera): distance for the swap is the eye's, the radii the walker's
  assert.equal(near.count, 2, 'from the eye at x = 30: x = 20 and 40 are within 15 m'); assert.equal(far.count, 3, 'x = 0, 10 and 80 are beyond it, and all five are within 100 m of the walker');
});

test('the far body casts the shadow: the proxy holds the far geometry, the near and far meshes cast nothing while a shadow radius is set', () => {
  const g = kitGroup(rootOf('goblin_hut'), { placements: at('goblin_hut', 0, 10, 20, 40, 80), landmarks: [] } as never, () => 0, { lods: lods(15), override: {} });
  const near = kids(g, 'goblin_hut')!, far = kids(g, 'goblin_hut__far')!, proxy = kids(g, 'goblin_hut__shadow')!;
  assert.equal(proxy.geometry, farGeometry, 'the shadow is cast by the cheap body'); assert.equal(near.castShadow, false); assert.equal(far.castShadow, false); assert.equal(proxy.castShadow, true);
  updateKitViews({ x: 0, z: 0 }, 1);
  proxy.onBeforeShadow?.(null as never, null as never, null as never, null as never, null as never, null as never, null as never);
  assert.equal(proxy.count, 4, 'x = 0, 10, 20 and 40 are within the 40 m shadow row');
});

// The bug the T4 stills caught first: a jump of the walker (a teleport) leaves the camera easing behind for a moment, and the re-bucket only looked at the walker, so every hut went to the far bucket and nothing was drawn at 13 m. The eye moving counts too.
test('the swap re-buckets when only the eye has moved', () => {
  const g = kitGroup(rootOf('goblin_hut'), { placements: at('goblin_hut', 0, 10, 20, 40, 80), landmarks: [] } as never, () => 0, { lods: lods(15), override: {} });
  const near = kids(g, 'goblin_hut')!;
  updateKitViews({ x: 10, z: 0 }, 1, { x: 500, z: 0 });   // the walker jumps to the huts; the camera has not followed yet (it is still far away)
  assert.equal(near.count, 0, 'seen from the stale eye every hut is far');
  updateKitViews({ x: 10, z: 0 }, 1, { x: 5, z: 0 });   // the walker has not moved again, the camera has arrived
  assert.equal(near.count, 3, 'x = 0, 10 and 20 (exactly 15 m) are within 15 m of the eye at x = 5');
});

// The bug the T4 stills caught: a re-baked or quantized far file carries its own scale in its node, and the far instances must use THAT node transform, not the full mesh's (else the far body is drawn at the wrong size and the hut vanishes).
test('the far instances carry the far body\'s own node transform', () => {
  const own = new Map<string, KitLod>([['goblin_hut', { geometry: farGeometry, material: farMaterial, dist: 15, matrix: new THREE.Matrix4().makeScale(2, 2, 2) }]]);
  const g = kitGroup(rootOf('goblin_hut'), { placements: at('goblin_hut', 0, 10, 20, 40, 80), landmarks: [] } as never, () => 0, { lods: own, override: {} });
  const near = kids(g, 'goblin_hut')!, far = kids(g, 'goblin_hut__far')!;
  updateKitViews({ x: 0, z: 0 }, 1);
  const len = (mesh: THREE.InstancedMesh, i: number) => { const e = mesh.instanceMatrix.array; return Math.hypot(e[i * 16], e[i * 16 + 1], e[i * 16 + 2]); };
  assert.ok(Math.abs(len(near, 0) - 1) < 1e-5, 'the near (full) instances keep the full mesh node scale (identity here)');
  assert.ok(far.count > 0 && Math.abs(len(far, 0) - 2) < 1e-5, 'the far instances are scaled by the far node\'s own transform');
});

test('a kind with no far body is what the radius rows made it: no far mesh, the full mesh, the proxy on the full geometry', () => {
  const g = kitGroup(rootOf('goblin_hut'), { placements: at('goblin_hut', 0, 10, 20, 40, 80), landmarks: [] } as never, () => 0, { override: {} });
  assert.equal(kids(g, 'goblin_hut__far'), undefined); assert.notEqual(kids(g, 'goblin_hut__shadow')!.geometry, farGeometry);
  updateKitViews({ x: 0, z: 0 }, 1); assert.equal(kids(g, 'goblin_hut')!.count, 5, 'all five are inside the 100 m draw row');
});
