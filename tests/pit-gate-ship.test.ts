// The shipped Pit gate (Pit intake #2, Lead's ruling 2026-09-30): the live gate opens on foot, so GPT's fused mesh ships as TWO nodes. The arch
// is static; the bars are one movable node whose origin is the bars' base, so a rotation or lift about that origin is a gate opening.
// Reads the GLB's JSON only (positions are meshopt-compressed; the split itself was checked vertex by vertex at intake).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Accessor = { count: number; min?: number[]; max?: number[] };
type Gltf = { scenes: { nodes: number[] }[]; nodes: { name: string; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }[]; meshes: { primitives: { attributes: { POSITION: number }; indices: number; material: number }[] }[]; accessors: Accessor[] };
const glb = (path: string): Gltf => { const raw = readFileSync(new URL(path, import.meta.url)), size = raw.readUInt32LE(12); return JSON.parse(raw.subarray(20, 20 + size).toString()); };

test('gate.glb: a static arch and one movable bars node, one material, 3,760 triangles in all, both at rest where the fused gate drew them', () => {
  const g = glb('../public/pit/props/gate.glb'), roots = g.scenes[0].nodes.map((n) => g.nodes[n]);
  assert.deepEqual(roots.map((n) => n.name), ['gate-arch', 'gate-bars']);
  const [arch, bars] = roots;
  for (const node of roots) { assert.ok(!node.rotation || node.rotation.every((v, i) => v === [0, 0, 0, 1][i]), `${node.name} rests unrotated`); assert.ok(!node.scale || node.scale.every((v) => v === 1), `${node.name} rests at scale 1`); }
  assert.ok(!arch.translation || arch.translation.every((v) => v === 0), 'the arch keeps GPT\'s base-centre origin');
  const prims = roots.map((n) => g.meshes[n.mesh!].primitives);
  assert.ok(prims.every((p) => p.length === 1), 'one primitive each');
  assert.equal(new Set(prims.flat().map((p) => p.material)).size, 1, 'one material: one texture set for both');
  const tris = prims.map((p) => g.accessors[p[0].indices].count / 3);
  assert.deepEqual(tris, [2484, 1276], 'stone blocks / iron bars, rails and collars');
  assert.equal(tris[0] + tris[1], 3760, 'GPT\'s gate, not a triangle lost');
  // The bars' origin is their base: the local box starts at y 0 and is centred in x; the node's translation puts it back at the base in gate space.
  const box = g.accessors[prims[1][0].attributes.POSITION], t = bars.translation!;
  assert.ok(Math.abs(box.min![1]) < 1e-3, `the bars' local origin is their lowest point (y ${box.min![1]})`);
  assert.ok(Math.abs(box.min![0] + box.max![0]) < 0.02, 'centred in x');
  assert.ok(t[1] > 0 && t[1] < 0.1, `the bars stand on the floor of the gate: y ${t[1]}`);
  const world = (a: number) => [box.min![a] + t[a], box.max![a] + t[a]];
  assert.ok(world(0)[0] > -1.3 && world(0)[1] < 1.3, 'the bars sit inside the 2.8 m arch');
  assert.ok(world(1)[1] > 2.2 && world(1)[1] < 2.4, 'and reach the top of the opening');
});

test('the chests ship as one mesh each (dressing only, never a moving part)', () => {
  for (const name of ['chest-a', 'chest-b']) {
    const g = glb(`../public/pit/props/${name}.glb`);
    assert.equal(g.nodes.length, 1, `${name}: one node`); assert.equal(g.meshes.length, 1); assert.equal(g.meshes[0].primitives.length, 1);
    assert.equal(g.accessors[g.meshes[0].primitives[0].indices].count / 3, 308, `${name}: GPT's 308 triangles`);
  }
});
