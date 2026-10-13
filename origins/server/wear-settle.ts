// What a paid kill wears (wear writer, slice 1: kills only; hits taken need the fight verifier to report them). ONE equipped wearable piece is bitten: the slot comes from the
// wear-repair rows' slot shares (wornSlot) and the roll is derived from the kill's token, so a retry of the same settle picks the same piece; an empty slot absorbs the bite. The
// piece wears by its tier's killWear row (wearAfter); a fresh piece starts at the weight class's wearMax (gear-defs.json). The line is ONE event `wear:<instance>:<seq>` in the
// settle's own batch (seq = the wear it was read at + 1, the same write guard gear_repair uses), so it commits or aborts with the kill. No ledger (migration 0032 absent) = no wear.
import { createHash } from 'node:crypto';
import type { Inventory } from '../inventory/inventory.ts';
import { freshPiece, wearAfter, wearKindOf, wearMaxOf, wornSlot } from '../gear/wear-repair.ts';
import type { Db } from './db.ts';
import * as store from './store.ts';

// Two rolls in [0, 1) from the token: which slot is bitten, and whether the event bites at all (a kill's chance row is 100).
export const rollsOf = (account: string, token: string): [number, number] => {
  const h = createHash('sha256').update(`${account}|wear|${token}`).digest();
  return [h.readUInt32BE(0) / 2 ** 32, h.readUInt32BE(4) / 2 ** 32];
};

export async function killWearLines(db: Db, kill: { account: string; character: string; token: string }, inventory: Inventory): Promise<store.Json[]> {
  const [slotRoll, biteRoll] = rollsOf(kill.account, kill.token), slot = wornSlot(slotRoll);
  const hit = inventory.items.flatMap((i) => { const k = i.location.kind === 'equipped' ? wearKindOf(i.item) : null; return k && k.slot === slot ? [{ id: i.id, kind: k }] : []; })[0];
  if (!hit) return [];
  const wears = await store.itemWears(db, kill.account, [hit.id]);
  if (wears === 'absent') return [];
  const stored = wears[hit.id], piece = stored ?? freshPiece(wearMaxOf(hit.kind.tier));
  const after = wearAfter(hit.kind.tier, piece, 'kill', biteRoll);
  if (after.worn === piece.worn) return [];
  const seq = (stored?.seq ?? 0) + 1;
  return [{ op: 'event', event_id: `wear:${hit.id}:${seq}`, kind: 'metal', account: kill.account, character: kill.character, payload: { wear: { instance: hit.id, seq, ...after } } }];
}
