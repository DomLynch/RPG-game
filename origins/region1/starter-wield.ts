// The starter items' bridge to the engine's LootId (Lead 2026-10-17: nobody could wield a Zone 1 starter piece). The paperdoll, the sheet and the fight all speak LootId (`<opponent>.<Slot>`);
// an `item:starter.*` definition has none, so lootOfView dropped it and gear_equip could not wear it. One row per starter item names the LootId it wields as (starter-wield.json, through the
// shared registry loader): the server fills GearPiece.lootId and the worn set from it, so the sheet, the paperdoll and the fight work unchanged. The piece is still the starter item (its own
// id, bound, no wear row); only the stand-in LootId is borrowed. The rusty sword has no row: Longsword is the default weapon and no opponent's loot has a Longsword LootId, so it waits on Combat.
import { isLootId, legacyLootOfItemId, loadRegistry, tableFromFile, type LootId, type Manifest } from '../../src/core/server.ts';
import DATA from './starter-wield.json' with { type: 'json' };
import MANIFEST from './starter-wield.manifest.json' with { type: 'json' };

/** The one loader: rows keyed by item id (a duplicate id or a missing field is refused), the item must be a starter item and the LootId one this game knows. */
export function loadStarterWield(raw: { wield?: readonly unknown[] }): ReadonlyMap<string, LootId> {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'starter-wield.json')]);
  const rows = (raw.wield ?? []) as readonly { id: string; lootId: string; maxQty: number }[];
  for (const r of rows) {
    if (!(r.maxQty >= 1)) throw Error(`starter-wield "${r.id}": maxQty is at least 1`);
    if (!r.id.startsWith('item:starter.')) throw Error(`starter-wield "${r.id}": only an item:starter.* item takes a stand-in LootId`);
    if (!isLootId(r.lootId)) throw Error(`starter-wield "${r.id}": "${r.lootId}" is not a LootId this game knows`);
  }
  return new Map(rows.map((r) => [r.id, r.lootId as LootId]));
}
export const STARTER_WIELD: ReadonlyMap<string, LootId> = loadStarterWield(DATA);
/** The ONE starter set (Lead 2026-10-17): the starter items are these rows. The ground items' `starterItem` table (origins/world/ground-items.ts) is built from them, so an item is declared once. */
export const STARTER_QTY: Readonly<Record<string, { readonly maxQty: number }>> = Object.fromEntries(DATA.wield.map((r) => [r.id, { maxQty: r.maxQty }]));

/** The LootId a held item stands as: a legacy `item:loot.*` piece is its own, a starter item takes its row's, anything else has none (null). The one reading gear_open and the worn set share. */
export const lootIdOfItem = (item: string): LootId | null => legacyLootOfItemId(item as Parameters<typeof legacyLootOfItemId>[0]) ?? STARTER_WIELD.get(item) ?? null;