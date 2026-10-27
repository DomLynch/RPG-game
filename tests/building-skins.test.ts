// Building skins (zone sandbox, 2026-10-16): a culture's look for a town's buildings as rows. The skin changes how a block looks, never its footprint or solid; empty = today's bricks.
// The renderer tests (real glb nodes, skinPieces, the frontier plan staying put) come with the renderer PR.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import DEFS from '../origins/world/building-skins.json' with { type: 'json' };
import { fitScale, loadSkins, modelOfNode, skinFit, skinIds, skinLod, skinParts } from '../origins/world/building-skins-rules.ts';

test('the goblin skin loads; a kind with no parts of its own takes the default; an unknown skin is none', () => {
  assert.deepEqual(skinIds(), ['goblin', 'dungeon']);
  assert.ok(skinParts('goblin', 'watchtower')!.every((p) => p.kind === 'watchtower') && skinParts('goblin', 'fence')!.every((p) => p.kind === 'fence'));
  assert.ok(skinParts('goblin', 'hall')!.every((p) => p.kind === 'default'), 'hall, forge, house...: the default parts'); assert.equal(skinParts('nope', 'hall'), null); assert.equal(skinParts('', 'hall'), null);
});
test('the loader refuses a bad part, a missing default and an unknown tint', () => {
  const parts = DEFS.parts, skins = DEFS.skins;
  assert.throws(() => loadSkins({ skins, parts: parts.map((p, i) => (i === 0 ? { ...p, shape: 'torus' } : p)) }), /shape is box/);
  assert.throws(() => loadSkins({ skins, parts: parts.map((p, i) => (i === 0 ? { ...p, size: [1, 1] } : p)) }), /3 sizes/);
  assert.throws(() => loadSkins({ skins, parts: parts.map((p, i) => (i === 0 ? { ...p, tint: 'neon' } : p)) }), /not a props tint/);
  assert.throws(() => loadSkins({ skins, parts: parts.filter((p) => p.kind !== 'default') }), /kind "default"/);
});
test('every model file exists, holds the nodes its row names, and stays under the per-file world cap (gzip) so a building loads on its own', () => {
  const WORLD_FILE = 1_300_000;   // check-budget.mjs WORLD_FILE: one world .glb at most 1.3 MB gzip
  for (const m of DEFS.models) {
    const buf = readFileSync(`public/${m.url}`), len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as { nodes: { name?: string }[] };   // the glb's JSON chunk
    const names = new Set(json.nodes.map((n) => n.name)); for (const node of m.nodes) assert.ok(names.has(node), `${m.id}: node ${node} is in ${m.url}`);
    assert.ok(gzipSync(buf).length < WORLD_FILE, `${m.url}: ${gzipSync(buf).length} bytes gzip is under the cap`);
  }
});
test('a model\'s far body (lod) is a row: its own file with the SAME node names, under the world cap, and the loader refuses a bad one', () => {
  const WORLD_FILE = 1_300_000;
  const withLod = DEFS.models.filter((m) => 'lod' in m) as (typeof DEFS.models[number] & { lod: { url: string; dist: number } })[];
  for (const m of withLod) {
    const buf = readFileSync(`public/${m.lod.url}`), len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as { nodes: { name?: string }[] };
    const names = new Set(json.nodes.map((n) => n.name)); for (const node of m.nodes) assert.ok(names.has(node), `${m.id}: lod holds node ${node}`);
    assert.ok(gzipSync(buf).length < WORLD_FILE, `${m.lod.url} is under the world cap`);
    assert.equal(skinLod(m.nodes[0]!)!.url, m.lod.url); assert.ok(m.lod.dist > 0);
  }
  assert.equal(skinLod('no_such_node'), null);
  const [first, ...rest] = DEFS.models;
  const bad = (lod: unknown) => loadSkins({ skins: DEFS.skins, parts: DEFS.parts, fits: DEFS.fits, models: [{ ...first!, lod }, ...rest] });
  assert.throws(() => bad({ url: first!.url, dist: 30 }), /lod is/); assert.throws(() => bad({ url: 'world/kit/x.glb', dist: 0 }), /lod is/); assert.throws(() => bad({ url: 'kit/x.glb', dist: 30 }), /lod is/);
  assert.doesNotThrow(() => bad({ url: 'world/kit/x_lod.glb', dist: 30 }));
});
test('a model with a budget row stays inside it: near and far triangle counts (the glTF index accessors) and the piece height', () => {
  const tris = (url: string) => { const buf = readFileSync(`public/${url}`), len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as { meshes: { primitives: { indices?: number }[] }[]; accessors: { count: number; max?: number[]; min?: number[] }[] }; return json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices === undefined ? 0 : json.accessors[p.indices]!.count / 3), 0); };
  const withBudget = DEFS.models.filter((m) => 'budget' in m) as (typeof DEFS.models[number] & { lod?: { url: string }; budget: { height?: number; width?: number; tris: number; lodTris?: number } })[];
  assert.ok(withBudget.length > 0);
  for (const m of withBudget) {
    assert.ok((m.budget.height ?? m.budget.width ?? 0) > 0 && m.budget.tris > 0, `${m.id}: budget names a height or a width (metres) and the near triangles`);
    assert.ok(tris(m.url) <= m.budget.tris, `${m.id}: ${tris(m.url)} near tris over ${m.budget.tris}`);
    assert.equal(m.lod !== undefined, m.budget.lodTris !== undefined, `${m.id}: a far body and its triangle budget go together`);
    if (m.lod) assert.ok(m.budget.lodTris! > 0 && m.budget.lodTris! < m.budget.tris && tris(m.lod.url) <= m.budget.lodTris!, `${m.id}: ${tris(m.lod.url)} far tris over ${m.budget.lodTris}`);
  }
});
test('a texture row names a real file and a slab size in metres, and the loader refuses a bad one', () => {
  const tex = (DEFS as unknown as { textures: { id: string; url: string; slabM: number }[] }).textures;
  assert.ok(tex.length > 0);
  for (const t of tex) assert.ok(readFileSync(`public/${t.url}`).length > 0 && t.slabM > 0, t.id);
  const load = (textures: unknown[]) => loadSkins({ skins: DEFS.skins, parts: DEFS.parts, fits: DEFS.fits, models: DEFS.models, textures });
  assert.throws(() => load([{ id: 'x', url: 'world/x.jpg', slabM: 0 }]), /slabM/); assert.throws(() => load([{ id: 'x', url: 'x.jpg', slabM: 2 }]), /texture/);
  assert.doesNotThrow(() => load([{ id: 'x', url: 'world/town/x.webp', slabM: 2 }]));
});
test('every fit names a node of its model; a fit scales its natural footprint into a block, capped and floored by its own row', () => {
  for (const f of DEFS.fits) assert.ok(DEFS.models.find((m) => m.id === f.model)!.nodes.includes(f.node), `${f.id} -> ${f.node}`);
  assert.equal(skinFit('goblin', 'watchtower')!.node, 'goblin_tower'); assert.equal(skinFit('goblin', 'hall'), null, 'a kind with no fit of its own has none (the block asks for the default)'); assert.equal(modelOfNode('goblin_hut')!.id, 'goblin-hut'); assert.equal(modelOfNode('nope'), null);
  const hut = skinFit('goblin', 'default')!; assert.equal(fitScale(hut, 8, 6), Math.min(8 / 5.24, 6 / 3.3)); assert.equal(fitScale(hut, 100, 100), 2.5, 'capped'); assert.equal(fitScale(hut, 0.1, 0.1), 0.6, 'floored');
});
