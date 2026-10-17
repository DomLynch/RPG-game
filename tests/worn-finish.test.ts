// The hand/paperdoll finish of a worn starter item: one row per item (its ground look's finish), keyed by the LootId it stands as; no second table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wornFinishes, type WornPiece } from '../origins/preview/worn-finish.ts';
import { groundFinish } from '../origins/preview/ground-looks.ts';
import { STARTER_WIELD } from '../origins/region1/starter-wield.ts';
import FINISHES from '../src/core/finish-rows.json' with { type: 'json' };

const worn = (item: string, lootId: string | null, where: WornPiece['where'] = 'equipped'): WornPiece => ({ item, lootId, where });

test('every starter item with a ground look carries a finish that is a real finish row', () => {
  const rows = new Set(FINISHES.finishRows.map((r) => r.id));
  for (const item of ['rusty-sword', 'knife', 'cleaver', 'gladius', 'estoc', 'goblin-scrap-cap', 'goblin-shin-plates'].map((s) => `item:starter.${s}`)) {
    const finish = groundFinish(item);
    assert.ok(finish !== undefined && rows.has(finish), `${item}: finish ${String(finish)} is a finish row`);
  }
});

test('an equipped starter piece yields its finish under the LootId it wields as', () => {
  const pieces = [...STARTER_WIELD].filter(([item]) => item === 'item:starter.knife' || item === 'item:starter.goblin-scrap-cap').map(([item, lootId]) => worn(item, lootId));
  assert.deepEqual(wornFinishes(pieces), { 'goblin.Knife': 'rust', 'goblin.Helmet': 'dull-iron' });
  assert.equal(wornFinishes([worn('item:starter.rusty-sword', 'zone1.Longsword')])['zone1.Longsword'], 'rust');   // Combat's LootId for the rusty sword: the finish does not depend on it existing yet
});

test('a pack or bank piece, a piece with no LootId, a legacy loot item and an item with no finish are left out (they keep their own metal)', () => {
  assert.deepEqual(wornFinishes([
    worn('item:starter.knife', 'goblin.Knife', 'pack'), worn('item:starter.cleaver', 'pitborn.Cleaver', 'bank'), worn('item:starter.gladius', null),
    worn('item:loot.goblin.Knife', 'goblin.Knife'), worn('item:no-such', 'goblin.Helmet'),
  ]), {});
});
