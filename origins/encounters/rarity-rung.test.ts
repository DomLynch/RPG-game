// The rung a drop is minted at comes from its RARITY through the rarityTier rows (loot-tier.json), with the region's rung as the fallback for an item with no row. Launch rows keep every drop at
// the region's rung (no behaviour change); this pins the mechanism, so Combat can set the ladder by editing rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, PC, RARITIES, TIERS, openInventory } from '../../src/core/server.ts';
import type { CharacterInstanceId, Tier } from '../../src/core/server.ts';
import { REGION1_LOOT_TIER, RARITY_RUNG, intoBackpack, loadEncounterContent, lookupOf, rungOf } from './encounters.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, lookup = lookupOf(content);

test('the launch rows: one per rarity, each a real rung, and all the region\'s rung so nothing changes', () => {
  assert.deepEqual([...RARITY_RUNG.keys()].sort(), [...RARITIES].sort(), 'every rarity has a row');
  for (const [r, tier] of RARITY_RUNG) { assert.ok((TIERS as readonly string[]).includes(tier), `${r} -> ${tier} is a rung`); assert.equal(tier, REGION1_LOOT_TIER); }
});

test('rungOf: the row\'s rung for a known rarity, the region rung for none or an unknown one', () => {
  const rows = new Map<string, Tier>([['common', 'Recruit'], ['fine', 'Veteran'], ['relic', 'Invictus']]);
  assert.deepEqual(['common', 'fine', 'relic'].map((r) => rungOf(r, rows)), ['Recruit', 'Veteran', 'Invictus']);
  assert.equal(rungOf(undefined, rows), REGION1_LOOT_TIER);
  assert.equal(rungOf('rare', rows), REGION1_LOOT_TIER, 'no row for this rarity: the fallback');
});

test('a common, a fine and a relic drop each mint at their row\'s rung', () => {
  const rows = new Map<string, Tier>([['common', 'Recruit'], ['fine', 'Veteran'], ['relic', 'Invictus']]);
  const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: 20, bankSize: 10 }, lookup);
  if (!inv.ok) throw new Error('pack');
  const items = ['item:frontier.ash-helm', 'item:frontier.thrall-gloves', 'item:frontier.mere-shield'];   // common, fine, relic
  const res = intoBackpack(inv.value, { table: 'loottable:test', items: items.map((item) => ({ item, quantity: 1 })), metal: 0 }, { wonBy: PC as CharacterInstanceId, killId: 'rarity-rung', encounter: null, at: '2026-10-17T10:00:00.000Z' }, content, rows);
  assert.ok(res.ok, 'the drops are received');
  const held = new Map(res.value.inventory.items.map((i) => [i.item, i.tier]));
  assert.deepEqual(items.map((i) => held.get(i as never)), ['Recruit', 'Veteran', 'Invictus']);
});
