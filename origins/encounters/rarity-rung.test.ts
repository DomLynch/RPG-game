// The rung a creature's drop is minted at (Strategy's spec, 2026-10-17): rungOf(creature level) from src/legends.ts + the item's rarity shift (the rarityShift rows of loot-tier.json), kept within
// 1..TIERS.length and the beta cap (betaCut.maxLootRung in career-rules.json). Every case names the creature level, the rarity, the rung and the rows it reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, PC, TIERS, openInventory } from '../../src/core/server.ts';
import type { CharacterInstanceId } from '../../src/core/server.ts';
import { rungOf as legendRung } from '../../src/legends.ts';
import CAREER_RULES from '../../src/core/career-rules.json' with { type: 'json' };
import LOOT_TIER from './loot-tier.json' with { type: 'json' };
import { REGION1_LOOT_TIER, RUNG_RULES, intoBackpack, loadEncounterContent, lookupOf, mintRung } from './encounters.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, lookup = lookupOf(content);
const tier = (rung: number) => TIERS[rung - 1];
const ZONE1 = 2, DUNGEON = 6;   // creature levels: Zone 1's band is L1-3, the dungeon's L4-6

test('the rows: shifts common 0 / fine +1 / relic +2 (common is the fallback), the beta cap is 4', () => {
  assert.deepEqual(LOOT_TIER.rarityShift.map((r) => [r.id, r.shift]), [['common', 0], ['fine', 1], ['relic', 2]]);
  assert.deepEqual(LOOT_TIER.rarityShift.filter((r) => 'fallback' in r).map((r) => r.id), ['common'], 'exactly one fallback row, common');
  assert.equal(CAREER_RULES.betaCut[0]!.maxLootRung, 4);
  assert.equal(RUNG_RULES.cap, 4);
});

test('Zone 1 creature (level 2): common rung 1, fine 2, relic 3', () => {
  assert.equal(legendRung(ZONE1), 1, 'src/legends.ts rungOf(2)');
  assert.deepEqual(['common', 'fine', 'relic'].map((r) => mintRung(r, ZONE1)), [tier(1), tier(2), tier(3)]);
});

test('dungeon creature (level 6): common, fine and relic each sit their shift above the level\'s rung', () => {
  const base = legendRung(DUNGEON);
  assert.ok(base >= 1 && base <= 2, `rungOf(6) = ${base} is in the dungeon band's 1-2`);
  assert.deepEqual(['common', 'fine', 'relic'].map((r) => mintRung(r, DUNGEON)), [tier(base), tier(base + 1), tier(base + 2)]);
});

test('an item with no rarity or an unknown one takes the fallback row (common) at the creature\'s rung, not the region rung', () => {
  assert.equal(mintRung(undefined, ZONE1), tier(1));
  assert.equal(mintRung('no-such-rarity', DUNGEON), tier(legendRung(DUNGEON)));
});

test('the beta cap clamps: a level 50 relic would be rung 10 + 2 but mints at maxLootRung; lifting the cut lifts it, and the top is the last rung', () => {
  assert.equal(legendRung(50), TIERS.length);
  assert.equal(mintRung('relic', 50), tier(4), 'capped at betaCut.maxLootRung (Veteran)');
  assert.equal(mintRung('relic', 50, { ...RUNG_RULES, cap: TIERS.length }), tier(TIERS.length), 'cap lifted: the last rung, never past it');
  assert.equal(mintRung('common', 50, { ...RUNG_RULES, cap: TIERS.length }), tier(TIERS.length));
});

test('minted through intoBackpack: a creature drop carries its rung, a drop with no creature level keeps the region rung', () => {
  const items = ['item:frontier.ash-helm', 'item:frontier.thrall-gloves', 'item:frontier.mere-shield'];   // common, fine, relic
  const rarities = items.map((i) => lookup(i as never)!.rarity);
  assert.deepEqual(rarities, ['common', 'fine', 'relic']);
  const drops = { table: 'loottable:test' as never, items: items.map((item) => ({ item: item as never, quantity: 1 })), metal: 0 };
  const mint = { wonBy: PC as CharacterInstanceId, killId: 'rarity-rung', encounter: null, at: '2026-10-17T10:00:00.000Z' };
  const open = () => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: 20, bankSize: 10 }, lookup); if (!inv.ok) throw new Error('pack'); return inv.value; };
  const tiers = (r: ReturnType<typeof intoBackpack>) => { assert.ok(r.ok); const held = new Map(r.value.inventory.items.map((i) => [i.item as string, i.tier])); return items.map((i) => held.get(i)); };
  assert.deepEqual(tiers(intoBackpack(open(), drops, { ...mint, foeLevel: ZONE1 }, content)), [tier(1), tier(2), tier(3)], 'level 2: common 1 / fine 2 / relic 3');
  assert.deepEqual(tiers(intoBackpack(open(), drops, mint, content)), items.map(() => REGION1_LOOT_TIER), 'no creature level: the region rung row');
});
