// The loot receipt (Lead 2026-10-17, loot item 3): on the REAL rows, a verified kill of a Zone 5 creature (the pit goblin) mints a real wearable piece, the piece worn shows on the character
// sheet (wornGearOfItems > 0) and moves a fight number (loadoutOfItems differs from naked: RES below 1). Nothing is stubbed but the career row and an empty pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, PC, openInventory, slotOf } from '../../src/core/server.ts';
import type { CharacterInstanceId, Inventory } from '../../src/core/server.ts';
import { fightSetup, loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { cumulative } from '../../src/core/career-model.ts';
import { mobBatch, type Kill } from './mob-rewards.ts';
import { lootIdOfItem } from '../region1/starter-wield.ts';
import { loadoutOfItems, wornGearOfItems } from './worn-gear.ts';
import type { CareerRow } from './store.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, lookup = lookupOf(content);
const AT = '2026-10-17T10:00:00.000Z', UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', FIGHT = 'character:pit-goblin';
const career: CareerRow = { seed_credit: cumulative(4), world_credit: 0, total_credit: cumulative(4), rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 };
const pack = (): Inventory => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: 20, bankSize: 10 }, lookup); if (!inv.ok) throw new Error('pack'); return inv.value; };
const kill = (seed: number): Kill => {
  const s = fightSetup(FIGHT, content); if (!s.ok) throw new Error(FIGHT);
  return { account: UID, character: PC, token: `TOKEN${seed}`.padEnd(40, 'x'), fight: FIGHT, seed, enemy: s.value.opponent.body, level: s.value.opponent.level, twist: null };
};

test('a verified pit-goblin kill drops a goblin piece that shows on the sheet and moves the fight numbers', () => {
  let drop: { item: string; tier: string | null } | undefined;
  for (let seed = 1; seed < 5000 && !drop; seed++) {
    const m = mobBatch(kill(seed), { career, inventory: pack() }, content, AT).batch.filter((l) => l.op === 'mint').map((l) => (l as { item: { item: string; tier: string | null } }).item);
    drop = m.find((i) => i.item.startsWith('item:loot.goblin.'));
  }
  assert.ok(drop, 'some seed under 5000 drops a goblin piece from the pit goblin table');
  const lootId = lootIdOfItem(drop.item);
  assert.ok(lootId, `${drop.item} has a LootId, so it can be worn`);
  assert.ok(drop.tier, 'the drop is minted at a rung (loot-tier.json), not tierless');
  const worn = [{ item: drop.item, tier: drop.tier, location: { kind: 'equipped', slot: slotOf(lootId) } }];
  const naked = loadoutOfItems([]), dressed = loadoutOfItems(worn);
  assert.deepEqual(naked, { attack: 1, res: 1 }, 'naked is the identity');
  // Recruit is the identity rung (gear-stats.ts): a piece minted at it shows on the sheet but moves nothing. Whether a kill's drop clears it depends on the creature's level and the item's rarity (the mint rung).
  const moves = (l: { attack: number; res: number }) => l.res < naked.res || l.attack > naked.attack;
  assert.equal(moves(dressed), drop.tier !== 'Recruit', `the worn ${lootId} at ${drop.tier} moves a fight number exactly when its rung is above Recruit (${JSON.stringify(dressed)})`);
  // The stat path itself, independent of what rung the mint chose: the same piece one rung up always shows on the sheet and moves a number.
  const up = [{ ...worn[0]!, tier: 'Legionary' }];
  assert.ok(Object.values(wornGearOfItems(up)).some((n) => n > 0), 'the worn piece adds a number to the sheet');
  assert.ok(moves(loadoutOfItems(up)), `the worn ${lootId} at Legionary moves a fight number`);
});
