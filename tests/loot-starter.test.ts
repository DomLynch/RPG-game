// The starter longsword (loot-pieces.json lootStarter, Lead + Strategy 2026-10-17): a live LootId, `zone1.Longsword`, so the rusty sword a new player finds can be worn and shown on the paperdoll. It belongs to no roster opponent,
// so it is never offered or dropped (LOOT does not list it); it is valid under isLootId like a retired piece, and its slot decides the weapon, so it fights as the default longsword with identical numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOT, LOOT_IDS, RETIRED_LOOT, STARTER_LOOT, cleanLoot, dropFor, fightWeapon, isLootId, ownedName, weaponOf, type Loot } from '../src/core/loot.ts';
import { LOOT_ITEMS } from '../src/core/items/loot-catalogue.ts';
import { itemIdFromLegacyLoot, legacyLootOfItemId } from '../src/core/contracts/ids.ts';
import { DEFAULT_WEAPON } from '../src/fight/moves.ts';
import { wornGear } from '../src/fight/gear-stats.ts';
import { gearNumbers, sheetOfLoot } from '../src/fight/gear-numbers.ts';
import { TIERS } from '../src/core/grades.ts';

const worn: Loot = { owned: ['zone1.Longsword'], equipped: { main: 'zone1.Longsword' }, taken: { 'zone1.Longsword': { tier: 1 } } } as Loot, bare: Loot = { owned: [], equipped: {} };

test('lootStarter: one row, a valid id that no opponent offers or drops', () => {
  assert.deepEqual([...STARTER_LOOT], ['zone1.Longsword']);
  assert.ok(isLootId('zone1.Longsword') && LOOT_IDS.has('zone1.Longsword'));
  for (const [opponent, pieces] of Object.entries(LOOT)) assert.ok(!pieces!.includes('zone1.Longsword'), `${opponent} does not offer it`);
  for (let marks = 0; marks < 64; marks++) assert.notEqual(dropFor('pitborn', marks, []), 'zone1.Longsword', `not dropped at ${marks} marks`);
  assert.ok(!RETIRED_LOOT.includes('zone1.Longsword'), 'it is not the retired plaguedoctor.Longsword, which stays retired');
  assert.ok(isLootId('plaguedoctor.Longsword'));
});

test('lootStarter: it fights as the default longsword with identical numbers', () => {
  assert.equal(weaponOf('zone1.Longsword'), 'longsword');
  assert.equal(weaponOf('zone1.Longsword'), DEFAULT_WEAPON);
  assert.equal(fightWeapon(worn), DEFAULT_WEAPON, 'wielding it is the default weapon');
  assert.deepEqual(wornGear(worn.equipped, (id) => (worn.taken?.[id]?.tier ? TIERS[worn.taken[id]!.tier! - 1] : undefined)), {}, 'no set owns it: no dial delta');
  assert.deepEqual(gearNumbers(worn), gearNumbers(bare), 'the Gear strip numbers are the bare ones');
  assert.deepEqual(sheetOfLoot(worn), sheetOfLoot(bare), 'the fight sheet is the bare one');
});

test('lootStarter: it survives a ledger read, has an item definition and maps both ways', () => {
  const held = cleanLoot({ owned: ['zone1.Longsword'], equipped: { main: 'zone1.Longsword' }, pack: [] });
  assert.ok(held.owned.includes('zone1.Longsword'), 'owned stays owned');
  assert.equal(held.equipped.main, 'zone1.Longsword', 'and stays worn');
  const def = LOOT_ITEMS.find((d) => d.id === 'item:loot.zone1.Longsword');
  assert.ok(def, 'the catalogue has exactly its definition');
  assert.equal(def.name, "Zone 1's longsword");
  const id = itemIdFromLegacyLoot('zone1.Longsword');
  assert.ok(id.ok);
  assert.equal(legacyLootOfItemId(id.value), 'zone1.Longsword');
  assert.equal(ownedName('zone1.Longsword'), "Zone 1's longsword");
});
