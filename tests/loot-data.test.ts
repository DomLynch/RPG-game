import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LADDER } from '../src/ladder.ts';
import { LOCKERS, LOOT_IDS, PAPERDOLL, cleanLoot, cleanProvenance, dropFor, emptyLoot, isLootId, lootName, mergeLoot, paperdollOf, recordTaken, slotOf, store, subRank, unwear, wear } from '../src/loot.ts';

// The draws of src/assets/loot.glb: `<opponent>.<slot>.<material>` with userData { opponent, slot, layer }.
function lootDraws(): { id: string; slot: string; opponent: string; layer: string }[] {
  const bytes = readFileSync('src/assets/loot.glb'), length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as { nodes: { name: string; mesh?: number; extras?: Record<string, string> }[] };
  return json.nodes.filter(n => n.mesh !== undefined).map(n => ({ id: n.name.split('.').slice(0, 2).join('.'), slot: n.extras?.slot ?? '', opponent: n.extras?.opponent ?? '', layer: n.extras?.layer ?? '' }));
}

test('loot: the piece list is exactly the draws of loot.glb, every piece names its opponent and a known slot, and every slot maps to one paperdoll key', { skip: !existsSync('src/assets/loot.glb') && 'src/assets/loot.glb is not on this checkout' }, () => {
  const draws = lootDraws();
  assert.deepEqual([...LOOT_IDS].sort(), [...new Set(draws.map(d => d.id))].sort(), 'src/loot.ts LOOT must list exactly the file\'s pieces');
  for (const draw of draws) { assert.equal(draw.id, `${draw.opponent}.${draw.slot}`, `${draw.id}: name and userData agree`); assert.ok(['replace', 'over'].includes(draw.layer), `${draw.id}: layer`); assert.ok(paperdollOf(slotOf(draw.id as never)), `${draw.id}: a paperdoll slot`); }
  for (const key of Object.keys(PAPERDOLL)) assert.ok(['head', 'chest', 'arms', 'hands', 'legs', 'feet', 'main', 'off'].includes(key));
  assert.equal(LOCKERS.open, 1); assert.equal(LOCKERS.total, 6);
});

test('loot: one fixed piece per opponent per career sub-rank, never a duplicate, nothing from an opponent without pieces', () => {
  assert.equal(subRank(0), 0); assert.equal(subRank(3), 1); assert.equal(subRank(14), 4); assert.equal(subRank(15), 5); assert.equal(subRank(30), 10); assert.equal(subRank(205), 45); assert.equal(subRank(-4), 0);
  assert.equal(dropFor('veteran', 0, []), 'veteran.Helmet'); assert.equal(dropFor('veteran', 3, []), 'veteran.Crest'); assert.equal(dropFor('veteran', 6, []), 'veteran.Greaves'); assert.equal(dropFor('veteran', 9, []), 'veteran.Helmet', 'the fourth sub-rank comes round to the first piece');
  assert.equal(dropFor('veteran', 9, ['veteran.Helmet']), null, 'a piece already owned never drops twice');
  assert.equal(dropFor('pitborn', 0, []), 'pitborn.Arms'); assert.equal(dropFor('pitborn', 3, []), 'pitborn.Arms', 'one piece: the same at every sub-rank until owned');
  assert.equal(dropFor('goblin', 0, []), 'goblin.Body'); assert.equal(dropFor('goblin', 3, []), 'goblin.Arms'); assert.equal(dropFor('goblin', 6, ['goblin.Body', 'goblin.Arms']), null, 'both Goblin pieces owned: nothing more');
  for (const rung of LADDER) for (let marks = 0; marks < 210; marks += 3) { const id = dropFor(rung.id, marks, []); if (id) assert.ok(isLootId(id) && id.startsWith(`${rung.id}.`)); }
});

test('loot: a saved record is cleaned — known ids only, no duplicates, worn pieces must be owned and in their own slot; store, wear, unwear and merge lose nothing', () => {
  assert.deepEqual(cleanLoot(null), emptyLoot()); assert.deepEqual(cleanLoot('x'), emptyLoot());
  assert.deepEqual(cleanLoot({ owned: ['veteran.Helmet', 'veteran.Helmet', 'goblin.Wings', 7], equipped: { head: 'veteran.Helmet', legs: 'veteran.Helmet', chest: 'nightborn.Body', wings: 'veteran.Helmet' } }), { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } });
  let loot = store(undefined, 'nightborn.Body'); loot = store(loot, 'nightborn.Body'); loot = store(loot, 'veteran.Greaves');
  assert.deepEqual(loot, { owned: ['nightborn.Body', 'veteran.Greaves'], equipped: {} });
  assert.deepEqual(wear(loot, 'veteran.Greaves').equipped, { legs: 'veteran.Greaves' }); assert.deepEqual(wear(loot, 'veteran.Helmet').equipped, {}, 'cannot wear what is not owned');
  assert.deepEqual(unwear(wear(loot, 'nightborn.Body'), 'chest').equipped, {});
  assert.deepEqual(mergeLoot({ owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } }, { owned: ['nightborn.Boots'], equipped: {} }), { owned: ['veteran.Helmet', 'nightborn.Boots'], equipped: { head: 'veteran.Helmet' } }, 'the union of both, the device\'s worn set when the cloud has none');
  assert.deepEqual(mergeLoot(undefined, { owned: ['nightborn.Boots'], equipped: { feet: 'nightborn.Boots' } }), { owned: ['nightborn.Boots'], equipped: { feet: 'nightborn.Boots' } });
  assert.equal(lootName('veteran.Helmet', 'the Veteran'), 'the Veteran\'s helmet');
});

test('loot: provenance is written once at the drop, cleaned like the rest, its record id fills once from null, and a merge keeps it', () => {
  const p = { opponent: 'veteran' as const, attempt: 5, healthLeft: 12, recordId: null, day: '2026-09-22' };
  let loot = store(undefined, 'veteran.Helmet', p);
  assert.deepEqual(loot, { owned: ['veteran.Helmet'], equipped: {}, taken: { 'veteran.Helmet': p } });
  assert.deepEqual(store(loot, 'veteran.Helmet', { ...p, attempt: 9 }), loot, 'a second drop of an owned piece changes nothing');
  loot = recordTaken(loot, 'veteran.Helmet', 'Ab3_-9xZ');
  assert.equal(loot.taken!['veteran.Helmet']!.recordId, 'Ab3_-9xZ');
  assert.deepEqual(recordTaken(loot, 'veteran.Helmet', 'ZZZZZZZZ'), loot, 'the record id is written once');
  assert.deepEqual(recordTaken(loot, 'veteran.Crest', 'Ab3_-9xZ'), loot, 'no provenance, nothing to fill');
  assert.deepEqual(cleanLoot(JSON.parse(JSON.stringify(loot))), loot, 'a saved record round-trips');
  assert.deepEqual(cleanLoot({ owned: ['veteran.Helmet'], equipped: {}, taken: { 'veteran.Helmet': { ...p, attempt: 0 } } }), { owned: ['veteran.Helmet'], equipped: {} }, 'a bad attempt count drops the provenance, never the piece');
  assert.deepEqual(cleanLoot({ owned: [], equipped: {}, taken: { 'veteran.Helmet': p } }), emptyLoot(), 'provenance for a piece not owned is dropped');
  assert.equal(cleanProvenance({ ...p, recordId: 'short' }), null); assert.equal(cleanProvenance({ ...p, day: 'yesterday' }), null); assert.equal(cleanProvenance({ ...p, opponent: 'nobody' }), null);
  assert.deepEqual(mergeLoot({ owned: ['veteran.Helmet'], equipped: {}, taken: { 'veteran.Helmet': { ...p, recordId: 'Ab3_-9xZ' } } }, { owned: ['veteran.Helmet', 'nightborn.Boots'], equipped: {}, taken: { 'veteran.Helmet': p, 'nightborn.Boots': { ...p, opponent: 'nightborn' } } }).taken,
    { 'veteran.Helmet': { ...p, recordId: 'Ab3_-9xZ' }, 'nightborn.Boots': { ...p, opponent: 'nightborn' } }, 'the device\'s filled id wins, the cloud\'s other pieces are kept');
});
