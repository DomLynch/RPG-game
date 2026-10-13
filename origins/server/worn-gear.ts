// The gear a character WEARS, as the server holds it: the dial deltas a record's sheet must include (expectedSheet's `gear`). Read from the character's equipped rows and the rung each
// instance was won at (origins_items.tier); the page runs the same wornGear (src/fight/gear-stats.ts) on the same two inputs, so a record mismatches only if the page and the ledger disagree
// on a piece or a rung. Wear is not read (wornGear does not read it on the page either). Nothing the client sent is used.
import type { Db } from './db.ts';
import * as store from './store.ts';
import { isTier, legacyLootOfItemId, type Tier } from '../../src/core/server.ts';
import { kitFrom, loadoutFor, wornGear, type Loadout } from '../../src/fight/server.ts';

type LootId = NonNullable<ReturnType<typeof legacyLootOfItemId>>;

// The worn pieces and the rung each was won at, as the ledger holds them: the one reading both wornGear (sheet deltas) and loadoutFor (the world's Attack and RES) take.
function wornOf(items: readonly { item: string; tier?: string | null; location: { kind: string; slot?: string } }[]): { equipped: Record<string, LootId>; tiers: Map<LootId, Tier | null> } {
  const equipped: Record<string, LootId> = {}, tiers = new Map<LootId, Tier | null>();
  for (const i of items) {
    if (i.location.kind !== 'equipped' || i.location.slot === undefined) continue;
    const id = legacyLootOfItemId(i.item as Parameters<typeof legacyLootOfItemId>[0]);
    if (!id) continue;   // a piece that is not a loot id adds nothing to the sheet
    if (i.location.slot in equipped) throw new Error(`two pieces worn in ${i.location.slot}`);
    if (tiers.has(id)) throw new Error(`${id} is worn twice`);   // wornGear's rung lookup is by LootId, so one id on two instances could not carry two rungs
    equipped[i.location.slot] = id;
    tiers.set(id, isTier(i.tier) ? i.tier : null);
  }
  return { equipped, tiers };
}

export function wornGearOfItems(items: readonly { item: string; tier?: string | null; location: { kind: string; slot?: string } }[]): Readonly<Record<string, number>> {
  const { equipped, tiers } = wornOf(items);
  return wornGear(equipped as Parameters<typeof wornGear>[0], (id) => tiers.get(id));
}

/** The world loop's hero Loadout (Attack out, RES in) from the same held rows: what the page derives from its worn set (gear-numbers.ts), so a world record's hero claim can be held to it. */
export function loadoutOfItems(items: readonly { item: string; tier?: string | null; location: { kind: string; slot?: string } }[]): Loadout {
  const { equipped, tiers } = wornOf(items);
  return loadoutFor(kitFrom(equipped as Parameters<typeof kitFrom>[0], (id) => tiers.get(id) ?? undefined));
}

type Row = { item: string; tier: string | null; loc_kind: string | null; loc_owner: string | null; loc_slot: string | null };

export function wornGearOfSnapshot(snap: { items: readonly unknown[] }, character: string): Readonly<Record<string, number>> {
  const rows = (snap.items as Row[]).filter((r) => r.loc_kind === 'equipped' && r.loc_owner === character);
  return wornGearOfItems(rows.map((r) => ({ item: r.item, tier: r.tier, location: { kind: 'equipped', ...(r.loc_slot ? { slot: r.loc_slot } : {}) } })));
}

export async function wornGearOf(db: Db, account: string, character: string): Promise<Readonly<Record<string, number>>> {
  return wornGearOfSnapshot(await store.open(db, account), character);
}

// The copy frozen on a claim or daily row when it was posted (migration 202610130025): { "<character>": [{ item, tier, slot }] }. Null or a character without pieces: no gear held.
export function wornGearOfFrozen(frozen: unknown, character: string): Readonly<Record<string, number>> {
  const pieces = frozen && typeof frozen === 'object' ? (frozen as Record<string, unknown>)[character] : undefined;
  if (!Array.isArray(pieces)) return {};
  return wornGearOfItems(pieces.map((p: { item: string; tier?: string | null; slot?: string }) => ({ item: p.item, tier: p.tier ?? null, location: { kind: 'equipped', ...(p.slot ? { slot: p.slot } : {}) } })));
}

/** The worn Loadout of a character as the ledger holds it: the ceiling of a world record's hero claim (world-verify.ts HeroLimit). */
export async function loadoutOf(db: Db, account: string, character: string): Promise<Loadout> {
  const rows = ((await store.open(db, account)).items as Row[]).filter((r) => r.loc_kind === 'equipped' && r.loc_owner === character);
  return loadoutOfItems(rows.map((r) => ({ item: r.item, tier: r.tier, location: { kind: 'equipped', ...(r.loc_slot ? { slot: r.loc_slot } : {}) } })));
}
