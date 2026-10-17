// The Frontier drops wear existing opponent pieces (frontier-wield.json, Characters & Art's picks): every Frontier gear item has a row, the row's piece fits the item's slot, the loader refuses a
// bad row, and a worn Frontier drop now adds to the sheet and moves a fight number (before this it had no LootId, so worn-gear.ts skipped it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { slotOf } from '../../src/core/server.ts';
import { SLOT_WEIGHT } from '../../src/fight/gear-stats.ts';
import { ITEMS } from '../region1/content.ts';
import { FRONTIER_WIELD, loadFrontierWield } from '../region1/frontier-wield.ts';
import { lootIdOfItem } from '../region1/starter-wield.ts';
import DATA from '../region1/frontier-wield.json' with { type: 'json' };
import { loadoutOfItems, wornGearOfItems } from './worn-gear.ts';

const frontier = (ITEMS as readonly { id: string; slot: string }[]).filter((i) => i.id.startsWith('item:frontier.'));

test('every Frontier gear item has a wield row, and the row\'s piece is for the same slot', () => {
  assert.ok(frontier.length >= 6);
  assert.deepEqual([...FRONTIER_WIELD.keys()].sort(), frontier.map((i) => i.id).sort(), 'one row per Frontier item, none extra');
  for (const i of frontier) assert.equal(slotOf(lootIdOfItem(i.id)!), i.slot, `${i.id} wears a ${i.slot} piece`);
});

test('the loader refuses a non-Frontier item, an unknown LootId and a duplicate id', () => {
  const rows = DATA.wield;
  assert.throws(() => loadFrontierWield({ wield: [{ id: 'item:starter.knife', lootId: 'goblin.Knife' }] }), /only an item:frontier/);
  assert.throws(() => loadFrontierWield({ wield: [{ id: 'item:frontier.ash-helm', lootId: 'goblin.Nonsense' }] }), /not a LootId/);
  assert.throws(() => loadFrontierWield({ wield: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
});

test('a worn Frontier drop shows on the sheet and moves a fight number', () => {
  for (const i of frontier) {
    if (SLOT_WEIGHT[i.slot as keyof typeof SLOT_WEIGHT] === 0) continue;   // the Shield is the guard profile, worth no points by Dom's decision (gear-stats.ts): it wears, it adds no number
    const worn = [{ item: i.id, tier: 'Gladiator', location: { kind: 'equipped', slot: i.slot } }];
    assert.ok(Object.values(wornGearOfItems(worn)).some((n) => n > 0), `${i.id} adds to the sheet`);
    const l = loadoutOfItems(worn);
    assert.ok(l.res < 1 || l.attack > 1, `${i.id} moves a fight number (${JSON.stringify(l)})`);
  }
});
