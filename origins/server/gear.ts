// POST /origins/gear_open | gear_equip | gear_unequip {character, ...}: the ONE item ledger's read and write API for owned and worn gear (Lead's plan, 2026-10-09). origins/inventory is the
// authority (the pure module's receive / equip / unequip), these ops only open the character's holdings, run it and commit the moved piece as a versioned `put` (a stale read aborts the
// batch, O0002). No new rule lives here: the rank check, the empty-slot rule ("take it off first", no silent swap) and the on-equip binding are inventory.equip's and items.ts equipItem's.
// The wearer's rank is the SERVER's (the career row's credit), never the request's. The body names a character and a piece id; it never carries a slot, a tier, a level or a version.
import type { ItemInstance, Location } from '../contracts/items.ts';
import { legacyLootOfItemId } from '../contracts/ids.ts';
import { equip, unequip, type Inventory, type Lookup } from '../inventory/inventory.ts';
import { levelOfCredit } from '../progression/model.ts';
import { DbError } from './db.ts';
import { Refused } from './errors.ts';
import { BadRequest, type Handler } from './handlers.ts';
import { openHoldingsWith, type Content } from './holdings.ts';
import * as store from './store.ts';
import { gearImportHandler } from './gear-import.ts';

const locOf = (l: Location): store.Json => (l.kind === 'equipped' ? { kind: l.kind, owner: l.owner, slot: l.slot } : { ...l });
// The rows that differ between two reads of one inventory, as origins_apply `put`s (the same shape upgrade.ts commits).
export function putsBetween(before: Inventory, after: Inventory): store.Json[] {
  const was = new Map(before.items.map((i) => [i.id, i]));
  return after.items.flatMap((i) => {
    const old = was.get(i.id);
    if (!old || (old.version === i.version && JSON.stringify(old.location) === JSON.stringify(i.location))) return [];
    return [{ op: 'put', id: i.id, expected_version: old.version, loc: locOf(i.location), bound_to: i.boundTo, upgrade_level: i.upgradeLevel ?? 0, history_append: i.history.slice(old.history.length) }];
  });
}

// One piece as the gear screen reads it: the instance, the engine's LootId (null for a non-loot item), where it is. Worn = `slot`, held = grid + index.
export type GearPiece = { id: string; item: string; lootId: string | null; slot: string | null; where: 'pack' | 'bank' | 'equipped'; index: number | null; paperdoll: string | null; tier: string | null; version: number };
export function gearView(inv: Inventory, lookup: Lookup): { pieces: GearPiece[]; worn: Record<string, string>; packSize: number; bankSize: number } {
  const pieces: GearPiece[] = [], worn: Record<string, string> = {};
  for (const i of inv.items) {
    const l = i.location, def = lookup(i.item);
    if (def?.category !== 'gear' || (l.kind !== 'pack' && l.kind !== 'bank' && l.kind !== 'equipped')) continue;
    pieces.push({ id: i.id, item: i.item, lootId: legacyLootOfItemId(i.item), slot: def.slot, where: l.kind, index: l.kind === 'equipped' ? null : l.index, paperdoll: l.kind === 'equipped' ? l.slot : null, tier: i.tier, version: i.version });
    if (l.kind === 'equipped') worn[l.slot] = i.id;
  }
  return { pieces, worn, packSize: inv.packSize, bankSize: inv.bankSize };
}

const characterOf = (v: unknown): string => { if (typeof v !== 'string' || v.length > 80) throw new BadRequest('character: a character id'); return v; };
const idOf = (v: unknown): string => { if (typeof v !== 'string' || v.length > 80) throw new BadRequest('id: a piece id'); return v; };
const indexOf = (v: unknown): number | undefined => { if (v === undefined) return undefined; if (!Number.isInteger(v) || (v as number) < 0) throw new BadRequest('index: a slot number'); return v as number; };
const refusal = (issues: { message: string }[]): Refused => new Refused(422, issues[0]?.message ?? 'refused', 'rule');

export function gearHandlers(content: Content): Record<string, Handler> {
  const lookup = content.lookup;
  const gearOpen: Handler = async ({ db, account }, body) => {
    const { inventory } = await openHoldingsWith(db, account, characterOf(body.character), content);
    return gearView(inventory, lookup);
  };
  const move = (run: (inv: Inventory, id: string, standing: { source: 'server'; careerLevel: number }, index: number | undefined) => ReturnType<typeof equip>): Handler => async ({ db, account }, body) => {
    const character = characterOf(body.character), id = idOf(body.id), index = indexOf(body.index);
    const { inventory, snap } = await openHoldingsWith(db, account, character, content);
    const standing = { source: 'server' as const, careerLevel: snap.career ? levelOfCredit(Number(snap.career.total_credit)) : 1 };
    const next = run(inventory, id, standing, index);
    if (!next.ok) throw refusal(next.issues);
    const batch = putsBetween(inventory, next.value);
    try { await store.commit(db, account, batch); }
    catch (e) { if (e instanceof DbError && e.code === 'O0002') throw new DbError('O0002', 'stale: the piece changed since it was read; open again and retry'); throw e; }
    return gearView(next.value, lookup);
  };
  return {
    gear_open: gearOpen,
    gear_import: gearImportHandler(content),
    gear_equip: move((inv, id, standing) => equip(inv, id, lookup, standing)),
    gear_unequip: move((inv, id, _s, index) => unequip(inv, id, lookup, index)),
  };
}
export type { ItemInstance };
