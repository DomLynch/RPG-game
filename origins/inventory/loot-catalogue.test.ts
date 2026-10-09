import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyLootOfItemId, itemIdFromLegacyLoot } from '../contracts/ids.ts';
import { parseItemDefinition } from '../contracts/items.ts';
import { LOOT_IDS, slotOf } from '../../src/loot.ts';
import { BUNDLE } from '../region1/content.ts';
import { loadRegion1 } from '../region1/load.ts';
import { LOOT_ITEMS } from './loot-catalogue.ts';

test('the catalogue has exactly one parsed item definition for every LootId (LOOT plus RETIRED_LOOT), on the legacy embedding, with loot.glb as its asset', () => {
  assert.equal(LOOT_ITEMS.length, LOOT_IDS.size);
  const ids = new Set<string>();
  for (const d of LOOT_ITEMS) {
    const parsed = parseItemDefinition(d);
    assert.ok(parsed.ok, `${d.id}: ${parsed.ok ? '' : parsed.issues.map((i) => i.message).join('; ')}`);
    const loot = legacyLootOfItemId(d.id as never);
    assert.ok(loot && LOOT_IDS.has(loot), `${d.id} maps back to a LootId`);
    assert.equal(d.id, itemIdFromLegacyLoot(loot).ok ? `item:loot.${loot}` : '', 'the embedding round-trips');
    assert.equal(d.slot, slotOf(loot!)); assert.equal(d.appearance.asset, `loot.glb/${loot}`);
    assert.ok(!ids.has(d.id), `${d.id} is unique`); ids.add(d.id);
  }
  for (const id of LOOT_IDS) assert.ok(ids.has(`item:loot.${id}`), `${id} has a definition`);
});

test('names read as the ledger does (lootName, capitalised); materials follow the slot; nothing is invented', () => {
  const by = (id: string) => LOOT_ITEMS.find((d) => d.id === `item:loot.${id}`)!;
  assert.equal(by('goblin.Helmet').name, "The Goblin's helmet");
  assert.equal(by('veteran.Helmet').name, "The Centurion's helmet");
  assert.deepEqual(['Helmet', 'Body', 'Arms', 'Greaves', 'Boots', 'Gloves'].map((s) => by(`goblin.${s}`).material), ['iron', 'leather', 'iron', 'iron', 'cloth', 'leather']);
  assert.ok(LOOT_ITEMS.every((d) => d.category === 'gear' && d.rarity === 'common' && d.stack === 1 && d.binding === 'none'));
});

test('the catalogue is part of the Region 1 bundle and the bundle still loads clean (weapon pieces are held, no table awards one)', () => {
  assert.equal(BUNDLE.filter((r) => String(r.id).startsWith('item:loot.')).length, LOOT_ITEMS.length);
  const loaded = loadRegion1();
  assert.ok(loaded.ok, loaded.ok ? '' : loaded.issues.map((i) => `${i.path} ${i.message}`).join('; '));
});
