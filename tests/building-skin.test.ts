// A building skin on the ground (Test Zone B3): a skin is fractions of the building, never changes where a town stands, and its model nodes are fetched per file.
import assert from 'node:assert/strict';
import test from 'node:test';
import { skinParts } from '../origins/world/building-skins-rules.ts';
import { zoneBuildings } from '../origins/world/goblin-field-rules.ts';
import { buildingSkin, skinPieces } from '../origins/preview/building-skin.ts';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { placementsByFile } from '../origins/preview/skin-models.ts';
import { loadZone, zoneAsBiome } from '../origins/zones/loader.ts';

test('a skin is fractions of the building: the same parts stand inside a small and a large block', () => {
  const parts = skinParts('goblin', 'default')!;
  for (const [w, h, d] of [[3, 2, 3], [10, 6, 8]] as const) {
    const ps = skinPieces(parts, 0, 0, 0, w, h, d);
    assert.equal(ps.length, parts.length); assert.ok(ps.every((p) => p.layer === 'plain' && Math.abs(p.x) <= w * 0.6 && Math.abs(p.z) <= d * 0.6 && p.y >= 0 && p.y <= h * 1.4), `${w}x${h}x${d}`);
  }
});
test('the seam: an unknown or empty skin is none; a known one answers a model for a fitted kind, parts for the rest, and nothing for a landmark it leaves bare', () => {
  assert.equal(buildingSkin(''), null); assert.equal(buildingSkin('nope'), null);
  const s = buildingSkin('goblin')!;
  const tower = s.model('watchtower', 4, 5, 1.2, 3.64, 3.65)!; assert.deepEqual([tower.node, tower.x, tower.z, tower.rotY, tower.scale], ['goblin_tower', 4, 5, 1.2, 1]);
  assert.equal(s.model('hall', 0, 0, 0, 8, 6)!.node, 'goblin_hut', 'a kind with no fit takes the default fit'); assert.equal(s.model('hall', 0, 0, 0, 8, 6, true), null, 'unless the caller is strict');
  assert.ok(s.parts('hall', 0, 0, 0, 8, 4, 6)!.length > 0); assert.equal(s.landmark('no-such-landmark', 0, 0, 0, 1, 1, 1), null);
});
test('the skin changes how a town looks, never where it stands: same solids, different pieces; Zones 1-4 ask for none', () => {
  const F = frontierPlan(true, '1'), plain = frontierBuild(F), skinned = frontierBuild(F, buildingSkin('goblin'));
  assert.ok(skinned.solids.every((s) => plain.solids.some((k) => k.x === s.x && k.z === s.z && k.r === s.r)), 'the skin adds no obstacle of its own');
  assert.ok(plain.solids.filter((s) => !skinned.solids.some((k) => k.x === s.x && k.z === s.z && k.r === s.r)).every((s) => s.r === 0.6), 'only bare landmark markers stop blocking; buildings keep their footprints');
  assert.notDeepEqual(skinned.pieces, plain.pieces); assert.ok(skinned.models.length > 0 && plain.models.length === 0, 'the skin stands model nodes; the bricks stand none');
  assert.deepEqual(frontierBuild(F, buildingSkin('')), plain, "'' is today's bricks"); assert.deepEqual(frontierBuild(F, buildingSkin('nope')), plain, 'an unknown skin is none');
  for (const id of ['1', '2', '3', '4']) assert.equal(zoneBuildings(loadZone(id)), '', `${id}: the real zones keep their bricks`);
  assert.equal(zoneBuildings(zoneAsBiome('1', 'goblin-fortress')), 'goblin', 'the fortress biome asks for the goblin skin');
});
test('model nodes are grouped by the file that holds them, so a zone fetches only the files its buildings use', () => {
  const at = { x: 0, z: 0, rotY: 0, scale: 1 }, by = placementsByFile([{ node: 'goblin_hut', ...at }, { node: 'goblin_hut', ...at }, { node: 'goblin_tower', ...at }, { node: 'not_a_node', ...at }]);
  assert.deepEqual([...by.keys()].sort(), ['world/kit/goblin_hut.glb', 'world/kit/goblin_tower.glb']); assert.equal(by.get('world/kit/goblin_hut.glb')!.length, 2);
});
