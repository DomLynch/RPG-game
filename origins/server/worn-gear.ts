// The gear a character WEARS, as the server holds it: the dial deltas a record's sheet must include (expectedSheet's `gear`). Read from the character's equipped rows and the rung each
// instance was won at (origins_items.tier); the page runs the same wornGear (src/fight/gear-stats.ts) on the same two inputs, so a record mismatches only if the page and the ledger disagree
// on a piece or a rung. Wear is not read (wornGear does not read it on the page either). Nothing the client sent is used.
import type { Db } from './db.ts';
import * as store from './store.ts';
import { isTier, legacyLootOfItemId, type Tier } from '../../src/core/server.ts';
import { wornGear } from '../../src/fight/server.ts';

type LootId = NonNullable<ReturnType<typeof legacyLootOfItemId>>;

export function wornGearOfItems(items: readonly { item: string; tier?: string | null; location: { kind: string; slot?: string } }[]): Readonly<Record<string, number>> {
  const equipped: Record<string, LootId> = {}, tiers = new Map<LootId, Tier | null>();
  for (const i of items) {
    if (i.location.kind !== 'equipped' || i.location.slot === undefined) continue;
    const id = legacyLootOfItemId(i.item as Parameters<typeof legacyLootOfItemId>[0]);
    if (!id) continue;   // a piece that is not a loot id adds nothing to the sheet
    if (i.location.slot in equipped) throw new Error(`two pieces worn in ${i.location.slot}`);
    equipped[i.location.slot] = id;
    tiers.set(id, isTier(i.tier) ? i.tier : null);
  }
  return wornGear(equipped as Parameters<typeof wornGear>[0], (id) => tiers.get(id));
}

export async function wornGearOf(db: Db, account: string, character: string): Promise<Readonly<Record<string, number>>> {
  const snap = await store.open(db, account);
  const rows = (snap.items as { item: string; tier: string | null; loc_kind: string | null; loc_owner: string | null; loc_slot: string | null }[]).filter((r) => r.loc_kind === 'equipped' && r.loc_owner === character);
  return wornGearOfItems(rows.map((r) => ({ item: r.item, tier: r.tier, location: { kind: 'equipped', ...(r.loc_slot ? { slot: r.loc_slot } : {}) } })));
}
