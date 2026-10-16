// Building skins (zone sandbox, 2026-10-16): a culture's look for a town's buildings as rows. The skin changes how a block looks, never its footprint or solid; empty = today's bricks.
import assert from 'node:assert/strict';
import test from 'node:test';
import DEFS from '../origins/world/building-skins.json' with { type: 'json' };
import { loadSkins, skinIds, skinParts } from '../origins/world/building-skins-rules.ts';
import { zoneBuildings } from '../origins/world/goblin-field-rules.ts';
import { skinPieces } from '../origins/preview/building-skin.ts';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { loadZone, zoneAsBiome } from '../origins/zones/loader.ts';

test('the goblin skin loads; a kind with no parts of its own takes the default; an unknown skin is none', () => {
  assert.deepEqual(skinIds(), ['goblin']);
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
test('a skin is fractions of the building: the same parts stand inside a small and a large block', () => {
  const parts = skinParts('goblin', 'default')!;
  for (const [w, h, d] of [[3, 2, 3], [10, 6, 8]] as const) {
    const ps = skinPieces(parts, 0, 0, 0, w, h, d);
    assert.equal(ps.length, parts.length); assert.ok(ps.every((p) => p.layer === 'plain' && Math.abs(p.x) <= w * 0.6 && Math.abs(p.z) <= d * 0.6 && p.y >= 0 && p.y <= h * 1.4), `${w}x${h}x${d}`);
  }
});
test('the skin changes how a town looks, never where it stands: same solids, different pieces; Zones 1-4 ask for none', () => {
  const F = frontierPlan(true, '1'), plain = frontierBuild(F), skinned = frontierBuild(F, 'goblin');
  assert.deepEqual(skinned.solids, plain.solids, 'footprints and solids are untouched'); assert.notDeepEqual(skinned.pieces, plain.pieces);
  assert.deepEqual(frontierBuild(F, ''), plain, "'' is today's bricks"); assert.deepEqual(frontierBuild(F, 'nope'), plain, 'an unknown skin is none');
  for (const id of ['1', '2', '3', '4']) assert.equal(zoneBuildings(loadZone(id)), '', `${id}: the real zones keep their bricks`);
  assert.equal(zoneBuildings(zoneAsBiome('1', 'goblin-fortress')), 'goblin', 'the fortress biome asks for the goblin skin');
});
