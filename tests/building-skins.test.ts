// Building skins (zone sandbox, 2026-10-16): a culture's look for a town's buildings as rows. The skin changes how a block looks, never its footprint or solid; empty = today's bricks.
// The renderer tests (real glb nodes, skinPieces, the frontier plan staying put) come with the renderer PR.
import assert from 'node:assert/strict';
import test from 'node:test';
import DEFS from '../origins/world/building-skins.json' with { type: 'json' };
import { fitScale, loadSkins, modelOfNode, skinFit, skinIds, skinParts } from '../origins/world/building-skins-rules.ts';

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
test('every fit names a node of its model; a fit scales its natural footprint into a block, capped and floored by its own row', () => {
  for (const f of DEFS.fits) assert.ok(DEFS.models.find((m) => m.id === f.model)!.nodes.includes(f.node), `${f.id} -> ${f.node}`);
  assert.equal(skinFit('goblin', 'watchtower')!.node, 'goblin_tower'); assert.equal(skinFit('goblin', 'hall'), null, 'a kind with no fit of its own has none (the block asks for the default)'); assert.equal(modelOfNode('goblin_hut')!.id, 'goblin-fort'); assert.equal(modelOfNode('nope'), null);
  const hut = skinFit('goblin', 'default')!; assert.equal(fitScale(hut, 8, 6), Math.min(8 / 5.24, 6 / 3.3)); assert.equal(fitScale(hut, 100, 100), 2.5, 'capped'); assert.equal(fitScale(hut, 0.1, 0.1), 0.6, 'floored');
});
