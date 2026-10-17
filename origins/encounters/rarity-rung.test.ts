// The rung a drop, a ground pickup or a shop item is minted at (Strategy + Lead, 2026-10-17): legends.rungOf(level) + mintRule.baseRungOffset (1) + the item's rarityShift (common 0, fine +1,
// rare +2, relic +3), kept within 1..TIERS.length and the beta cap (betaCut.maxLootRung 4); the level is the creature's, or the zone band's midpoint when no creature made the mint; a mint with
// neither is REFUSED. Every case names the level, rarity, rung and the rows it reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, PC, TIERS, openInventory } from '../../src/core/server.ts';
import type { CharacterInstanceId } from '../../src/core/server.ts';
import { rungOf as legendRung } from '../../src/legends.ts';
import CAREER_RULES from '../../src/core/career-rules.json' with { type: 'json' };
import LOOT_TIER from './loot-tier.json' with { type: 'json' };
import { GROUND_ITEMS } from '../world/ground-items.ts';
import { REGION1_SHOPS } from '../region1/shops.ts';
import { zoneBand, zoneMintLevel } from '../zones/band.ts';
import { RUNG_RULES, intoBackpack, loadEncounterContent, lookupOf, mintRung } from './encounters.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, lookup = lookupOf(content);
const tier = (rung: number) => TIERS[rung - 1];
const ZONE1 = 2, DUNGEON = 6, RARITIES = ['common', 'fine', 'rare', 'relic'];   // creature levels: Zone 1's band is L1-3, the dungeon's L4-6
const rungs = (level: number) => RARITIES.map((r) => mintRung(r, level).tier);

test('the rows: base offset 1; shifts common 0 (the fallback) / fine 1 / rare 2 / relic 3; the beta cap 4; no Gladiator row', () => {
  assert.deepEqual(LOOT_TIER.mintRule.map((r) => r.baseRungOffset), [1]);
  assert.deepEqual(LOOT_TIER.rarityShift.map((r) => [r.id, r.shift]), [['common', 0], ['fine', 1], ['rare', 2], ['relic', 3]]);
  assert.deepEqual(LOOT_TIER.rarityShift.filter((r) => 'fallback' in r).map((r) => r.id), ['common'], 'exactly one fallback row');
  assert.equal('lootTierRule' in LOOT_TIER, false, 'the global Gladiator mint is gone');
  assert.equal(CAREER_RULES.betaCut[0]!.maxLootRung, 4);
  assert.deepEqual([RUNG_RULES.base, RUNG_RULES.cap], [1, 4]);
});

test('Zone 1 creature (level 2, legends.rungOf 1): common 2 Legionary, fine 3 Gladiator, rare 4 and relic (wanted 5) 4 Veteran', () => {
  assert.equal(legendRung(ZONE1), 1);
  assert.deepEqual(rungs(ZONE1), [tier(2), tier(3), tier(4), tier(4)]);
  assert.deepEqual(['common', 'relic'].map((r) => mintRung(r, ZONE1).clamped), [false, true], 'only the relic hits the cap');
  assert.equal(mintRung('relic', ZONE1).wanted, 5);
});

test('dungeon creature (level 6, rungOf 2): common 3, fine 4, rare and relic (wanted 5 and 6) 4; level 4 and 5 (rungOf 1) are as Zone 1', () => {
  assert.equal(legendRung(DUNGEON), 2);
  assert.deepEqual(rungs(DUNGEON), [tier(3), tier(4), tier(4), tier(4)]);
  assert.deepEqual(rungs(4), rungs(ZONE1));
  assert.deepEqual(rungs(5), rungs(ZONE1));
});

test('an item with no rarity or an unknown one takes the fallback row (common)', () => {
  assert.equal(mintRung(undefined, ZONE1).tier, tier(2));
  assert.equal(mintRung('no-such-rarity', DUNGEON).tier, tier(3));
});

test('the beta cap clamps and lifts with the cut: a level 50 relic is rung 10 + 1 + 3 but mints at the cap; lifted, the last rung and never past it', () => {
  assert.equal(legendRung(50), TIERS.length);
  assert.deepEqual([mintRung('relic', 50).tier, mintRung('relic', 50).clamped], [tier(4), true]);
  assert.equal(mintRung('relic', 50, { ...RUNG_RULES, cap: TIERS.length }).tier, tier(TIERS.length));
  assert.equal(mintRung('common', 50, { ...RUNG_RULES, cap: TIERS.length }).tier, tier(TIERS.length));
});

const items = ['item:frontier.ash-helm', 'item:frontier.thrall-gloves', 'item:frontier.mere-shield'];   // common, fine, relic
const drops = { table: 'loottable:test' as never, items: items.map((item) => ({ item: item as never, quantity: 1 })), metal: 0 };
const mint = { wonBy: PC as CharacterInstanceId, killId: 'rarity-rung', encounter: null, at: '2026-10-17T10:00:00.000Z' };
const open = () => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: 20, bankSize: 10 }, lookup); if (!inv.ok) throw new Error('pack'); return inv.value; };
const tiersOf = (r: ReturnType<typeof intoBackpack>) => { assert.ok(r.ok); const held = new Map(r.value.inventory.items.map((i) => [i.item as string, i.tier])); return items.map((i) => held.get(i)); };

test('minted through intoBackpack: a creature drop carries its rung and the receipt names the clamp; a zone-band mint prices at the band midpoint', () => {
  assert.deepEqual(['common', 'fine', 'relic'], items.map((i) => lookup(i as never)!.rarity));
  const got = intoBackpack(open(), drops, { ...mint, level: ZONE1 }, content);
  assert.deepEqual(tiersOf(got), [tier(2), tier(3), tier(4)], 'level 2: common 2 / fine 3 / relic 4 (wanted 5, clamped)');
  assert.ok(got.ok && got.value.clamped.length === 1 && /mere-shield .*wanted rung 5, minted at Veteran by the cap/.test(got.value.clamped[0]!), 'the receipt names the clamp');
  const band = zoneBand('zone1')!, mid = zoneMintLevel('zone1')!;
  assert.equal(mid, Math.floor((band[0] + band[1]) / 2), 'the midpoint of the zone row\'s spawn levels');
  assert.deepEqual(tiersOf(intoBackpack(open(), drops, { ...mint, level: mid }, content)), ['common', 'fine', 'relic'].map((r) => mintRung(r, mid).tier), 'a ground pickup or shop item in the zone mints as a creature of the band midpoint would');
});

test('a mint with neither a creature nor a zone level is REFUSED, not defaulted; an untiered item needs no level', () => {
  const none = intoBackpack(open(), drops, mint, content);
  assert.equal(none.ok, false);
  assert.ok(!none.ok && none.issues.some((i) => i.code === 'no-mint-level'), 'the refusal names the missing level');
  assert.ok(intoBackpack(open(), { ...drops, items: [{ item: 'item:grave-iron' as never, quantity: 1 }] }, mint, content).ok, 'iron is not tiered');
});

test('every ground row and shop names a zone that has a level band (so none can reach the refusal)', () => {
  assert.equal(zoneMintLevel('zone99'), null);
  for (const [id, r] of Object.entries(GROUND_ITEMS)) assert.notEqual(zoneMintLevel(r.zone), null, `${id}: zone ${r.zone}`);
  for (const [id, s] of REGION1_SHOPS) assert.ok(s.zone !== undefined && zoneMintLevel(s.zone) !== null, `${id}: its zone has a band`);
});
