// The item catalogue of the shared fight engine's loot: ONE `item:loot.<LootId>` definition for every piece src/loot.ts knows (LOOT plus RETIRED_LOOT), generated from that file so
// the roster and the server's registry cannot drift. `item:loot.<LootId>` is the legacy embedding (contracts/ids.ts itemIdFromLegacyLoot); the asset is loot.glb's own piece
// (the fixtures.ts helmetDef pattern), so the gear screen shows and dresses it with no new art; the name is lootName's, capitalised ("The Goblin's helmet"). No number lives here:
// power is 'slot-weight' as for every loot piece, and every piece is common (rarity is not part of today's ledger).
import { LOOT_IDS, lootName, slotOf, type LootId, type LootSlot } from '../../src/loot.ts';
import { ROSTER, type OpponentId } from '../../src/roster.ts';
import type { Material } from '../contracts/items.ts';

const MATERIAL: Partial<Record<LootSlot, Material>> = { Body: 'leather', Gloves: 'leather', Boots: 'cloth' };   // every other slot (plate, crest, shield, weapon) is iron
const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const lootItemDef = (id: LootId) => ({
  kind: 'item-definition', schemaVersion: 1, id: `item:loot.${id}`, name: sentence(lootName(id, ROSTER[id.split('.')[0] as OpponentId].name)), category: 'gear', rarity: 'common',
  slot: slotOf(id), power: 'slot-weight', material: MATERIAL[slotOf(id)] ?? 'iron', appearance: { asset: `loot.glb/${id}` }, story: 'none', binding: 'none', stack: 1,
});
export const LOOT_ITEMS = [...LOOT_IDS].sort().map((id) => lootItemDef(id as LootId));
// The generated ids as a set: the one thing the Region 1 weapon rule exempts (load.ts), so nothing else can slip in under the `item:loot.` prefix.
export const LOOT_ITEM_IDS: ReadonlySet<string> = new Set(LOOT_ITEMS.map((d) => d.id));
