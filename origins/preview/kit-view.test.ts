import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import RAW from './kit-view.json' with { type: 'json' };
import { kitViewFor, loadKitViewRules } from './kit-view-rules.ts';
import { kitGroup, kitRadiusOverride, updateKitViews } from './frontier-kit-view.ts';

// The kit's view rules are rows (kit-view.json). The default rows must reproduce what the code did before them: bush_ and tuft_ nodes cast no shadow, every other node does, no radius limits.
test('the rows keep the old NO_SHADOW regex for every kind and no radius except the goblin kit', () => {
  for (const name of ['bush_a', 'bush_', 'tuft_1']) assert.equal(kitViewFor(name).castShadow, false, name);
  for (const name of ['tree_a', 'goblin_hut', 'boulder_b', 'bushy', 'xbush_a', '']) assert.equal(kitViewFor(name).castShadow, true, name);
  for (const name of ['bush_a', 'tuft_b', 'tree_a', 'goblin_hut', 'rock']) assert.equal(kitViewFor(name).castShadow, !/^(bush_|tuft_)/.test(name), `${name} matches the old regex`);
  for (const name of ['bush_a', 'tuft_b', 'tree_a', 'rock', 'boulder_b']) { assert.equal(kitViewFor(name).shadowRadius, 0, name); assert.equal(kitViewFor(name).drawRadius, 0, name); }
});

// Re-pinned (Lead 2026-10-22, #3583): the goblin kit (goblin_hut, totem, palisades, gate, tower, spikes) casts only within 40 m of the walker and is drawn only within 100 m. T4 A/B of one Zone 1 fight frame at ?crowd=0:
// 1,596,884 GL triangles with the old rows, 899,086 with these two radii (-44%); Lead read the 375 idle stills, no visible difference at the fight camera, glint kept.
test('the goblin kit rows are the A/B arm C: shadow 40 m, draw 100 m', () => {
  for (const name of ['goblin_hut', 'goblin_totem', 'goblin_palisade_a', 'goblin_gate', 'goblin_tower', 'goblin_spikes']) { const r = kitViewFor(name); assert.equal(r.castShadow, true, name); assert.equal(r.shadowRadius, 40, name); assert.equal(r.drawRadius, 100, name); }
});

test('the loader refuses a row that cannot be run', () => {
  const rows = (...fs: Record<string, unknown>[]) => ({ kitView: fs.map((fields, i) => ({ id: `r${i}`, fields })) });
  const ok = { prefix: '', castShadow: true, shadowRadius: 0, drawRadius: 0 };
  assert.doesNotThrow(() => loadKitViewRules(rows(ok)));
  assert.throws(() => loadKitViewRules(rows({ ...ok, shadowRadius: -1 })), /shadowRadius/);
  assert.throws(() => loadKitViewRules(rows({ ...ok, drawRadius: 'far' })), /drawRadius/);
  assert.throws(() => loadKitViewRules(rows({ ...ok, castShadow: 'yes' })), /castShadow/);
  assert.throws(() => loadKitViewRules(rows({ ...ok, prefix: 'x_' })), /default row/);
  assert.throws(() => loadKitViewRules(rows(ok, { ...ok, prefix: 'x_' })), /last/);
  assert.equal(loadKitViewRules(RAW).length, 4);
});

test('the preview link reads its two radii and nothing else', () => {
  assert.deepEqual(kitRadiusOverride(''), { shadowRadius: undefined, drawRadius: undefined });
  assert.deepEqual(kitRadiusOverride('?kitshadow=30&kitdraw=90'), { shadowRadius: 30, drawRadius: 90 });
  assert.deepEqual(kitRadiusOverride('?kitshadow=-1&kitdraw=abc'), { shadowRadius: undefined, drawRadius: undefined });
});

const nodes = ['tree_a', 'bush_b', 'tuft_c', 'goblin_hut'];
const rootOf = () => { const g = new THREE.Group(); for (const n of nodes) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); m.name = n; g.add(m); } return g; };
const kit = { placements: nodes.flatMap((node) => [0, 10, 20, 40, 80].map((x, i) => ({ node, x, z: 0, rotY: i * 0.3, scale: 1 + i * 0.1 }))), landmarks: [] };

const OLD_ROWS = [{ prefix: 'bush_', castShadow: false, shadowRadius: 0, drawRadius: 0 }, { prefix: 'tuft_', castShadow: false, shadowRadius: 0, drawRadius: 0 }, { prefix: '', castShadow: true, shadowRadius: 0, drawRadius: 0 }];
test('with no radius rows kitGroup is what it was: one mesh per node, the old castShadow, every instance, no proxy', () => {
  const g = kitGroup(rootOf(), kit as never, () => 0, { rules: OLD_ROWS, override: {} });
  assert.equal(g.children.length, nodes.length);
  for (const c of g.children as THREE.InstancedMesh[]) { assert.equal(c.count, 5, c.name); assert.equal(c.castShadow, !/^(bush_|tuft_)/.test(c.name), c.name); assert.ok(!c.name.endsWith('__shadow')); }
  const before = (g.children[0] as THREE.InstancedMesh).instanceMatrix.array.slice(); updateKitViews({ x: 0, z: 0 }, 1);   // nothing registered: nothing moves
  assert.deepEqual([...(g.children[0] as THREE.InstancedMesh).instanceMatrix.array], [...before]);
});

test('a shadow radius moves the cast to a proxy that holds only the near instances, and a draw radius draws only the near ones', () => {
  const g = kitGroup(rootOf(), kit as never, () => 0, { override: { shadowRadius: 15, drawRadius: 50 } });
  const by = (n: string) => g.children.find((c) => c.name === n) as THREE.InstancedMesh | undefined;
  const hut = by('goblin_hut')!, proxy = by('goblin_hut__shadow')!;
  assert.ok(proxy, 'the casting kind has a proxy'); assert.equal(hut.castShadow, false); assert.equal(proxy.castShadow, true);
  assert.equal(by('bush_b__shadow'), undefined, 'a kind that casts nothing gets no proxy');
  updateKitViews({ x: 0, z: 0 }, 1);
  assert.equal(hut.count, 4, 'x = 0, 10, 20, 40 are within 50 m; 80 is not');
  proxy.onBeforeShadow?.(null as never, null as never, null as never, null as never, null as never, null as never, null as never); assert.equal(proxy.count, 2, 'x = 0 and 10 are within 15 m');
  proxy.onAfterShadow?.(null as never, null as never, null as never, null as never, null as never, null as never, null as never); assert.equal(proxy.count, 0, 'the picture draws none of the proxy');
  updateKitViews({ x: 0, z: 0 }, 1); updateKitViews({ x: 0.2, z: 0 }, 1);   // under the step: no re-pack, same counts
  assert.equal(hut.count, 4);
  updateKitViews({ x: 60, z: 0 }, 1);
  assert.equal(hut.count, 4, 'from x = 60: x = 10 (exactly 50 m away), 20, 40 and 80 are within 50 m; 0 is 60 m away');
  assert.equal((by('tree_a') as THREE.InstancedMesh).count, 4, 'the other casting kind follows the same radii');
});
