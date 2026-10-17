// Building skins (zone sandbox, 2026-10-16): a culture's look for a town's buildings as rows. The skin changes how a block looks, never its footprint or solid; empty = today's bricks.
import assert from 'node:assert/strict';
import test from 'node:test';
import DEFS from '../origins/world/building-skins.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { fitScale, loadSkins, modelOfNode, skinFit, skinIds, skinParts } from '../origins/world/building-skins-rules.ts';
import { zoneBuildings } from '../origins/world/goblin-field-rules.ts';
import { skinPieces } from '../origins/preview/building-skin.ts';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { loadZone, zoneAsBiome } from '../origins/zones/loader.ts';

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
test('every model node a row names exists in the real glb, and every fit names a node of its model', () => {
  for (const m of DEFS.models) {
    const buf = readFileSync(`public/${m.url}`), len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as { nodes: { name?: string }[] };   // the glb's JSON chunk
    const names = new Set(json.nodes.map((n) => n.name)); for (const node of m.nodes) assert.ok(names.has(node), `${m.id}: node ${node} is in ${m.url}`);
  }
  for (const f of DEFS.fits) assert.ok(DEFS.models.find((m) => m.id === f.model)!.nodes.includes(f.node), `${f.id} -> ${f.node}`);
  assert.equal(skinFit('goblin', 'watchtower')!.node, 'goblin_tower'); assert.equal(skinFit('goblin', 'hall'), null, 'a kind with no fit of its own has none (the block asks for the default)'); assert.equal(modelOfNode('goblin_hut')!.id, 'goblin-fort'); assert.equal(modelOfNode('nope'), null);
  const hut = skinFit('goblin', 'default')!; assert.equal(fitScale(hut, 8, 6), Math.min(8 / 5.24, 6 / 3.3)); assert.equal(fitScale(hut, 100, 100), 2.5, 'capped'); assert.equal(fitScale(hut, 0.1, 0.1), 0.6, 'floored');
});
test('a skin is fractions of the building: the same parts stand inside a small and a large block', () => {
  const parts = skinParts('goblin', 'default')!;
  for (const [w, h, d] of [[3, 2, 3], [10, 6, 8]] as const) {
    const ps = skinPieces(parts, 0, 0, 0, w, h, d);
    assert.equal(ps.length, parts.length); assert.ok(ps.every((p) => p.layer === 'plain' && Math.abs(p.x) <= w * 0.6 && Math.abs(p.z) <= d * 0.6 && p.y >= 0 && p.y <= h * 1.4), `${w}x${h}x${d}`);
  }
});
test('the skin changes how a town looks, never where it stands: same solids, different pieces; Zones 1-4 ask for none', () => {
  const F = frontierPlan(true, '1'), plain = frontierBuild(F), skinned = frontierBuild(F, 'goblin');
  assert.ok(skinned.solids.every((s) => plain.solids.some((k) => k.x === s.x && k.z === s.z && k.r === s.r)), 'the skin adds no obstacle of its own'); assert.ok(plain.solids.filter((s) => !skinned.solids.some((k) => k.x === s.x && k.z === s.z && k.r === s.r)).every((s) => s.r === 0.6), 'only bare landmark markers stop blocking; buildings keep their footprints'); assert.notDeepEqual(skinned.pieces, plain.pieces);
  assert.deepEqual(frontierBuild(F, ''), plain, "'' is today's bricks"); assert.deepEqual(frontierBuild(F, 'nope'), plain, 'an unknown skin is none');
  for (const id of ['1', '2', '3', '4']) assert.equal(zoneBuildings(loadZone(id)), '', `${id}: the real zones keep their bricks`);
  assert.equal(zoneBuildings(zoneAsBiome('1', 'goblin-fortress')), 'goblin', 'the fortress biome asks for the goblin skin');
});
