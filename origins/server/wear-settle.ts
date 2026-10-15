// What a paid kill wears (wear writer, slice 1: kills only; hits taken need the fight verifier to report them). ONE equipped wearable piece is bitten: the slot comes from the
// wear-repair rows' slot shares (wornSlot) and the roll is derived from the kill's token, so a retry of the same settle picks the same piece; an empty slot absorbs the bite. The
// piece wears by its tier's killWear row (wearAfter); a fresh piece starts at the weight class's wearMax (gear-defs.json). The line is ONE event `wear:<instance>:<seq>` in the
// settle's own batch (seq = the wear it was read at + 1, the same write guard gear_repair uses), so it commits or aborts with the kill. No ledger (migration 0032 absent) = no wear.
import { createHash } from 'node:crypto';
import type { EncounterContent } from '../encounters/encounters.ts';
import { lookupOf } from '../encounters/encounters.ts';
import type { Inventory } from '../../src/core/server.ts';
import { GEAR } from '../../src/fight/server.ts';
import { freshPiece, wearAfter, wearKindOf, wornSlot, type WearTier } from '../gear/wear-repair.ts';
import { DbError, type Db } from './db.ts';
import { openHoldingsWith } from './holdings.ts';
import * as store from './store.ts';

// How much wear a fresh piece of this tier takes before it is worn out: the preset gear row of the same weight class (src/fight/gear-defs.json `wearMax`, Dom retunes it there).
export const wearMaxOf = (tier: WearTier): number => {
  const row = Object.values(GEAR.rows).find((r) => r.preset && r.weightClass === tier.id);
  if (!row) throw new Error(`gear-defs has no preset gear row for weight class ${tier.id}`);
  return row.wearMax;
};

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
  return [{ op: 'event', event_id: `wear:${hit.id}:${seq}`, kind: 'metal', account: kill.account, character: kill.character, payload: { wear: { instance: hit.id, seq, worn: after.worn, max: after.max, baseMax: after.baseMax } } }]   // field by field: the stored row's own seq must not survive a spread;
}

// The wear hook the settle paths take (encounter settle, zone kill): reads the character's holdings itself and answers the kill's wear lines. A failed read is NO wear, never a failed kill.
export type KillWear = (kill: { account: string; character: string; token: string }, db: Db) => Promise<store.Json[]>;
export const killWear = (content: EncounterContent): KillWear => async (kill, db) => {
  try { return await killWearLines(db, kill, (await openHoldingsWith(db, kill.account, kill.character, { lookup: lookupOf(content) })).inventory); }
  catch (e) { console.error('origins-writer: the kill wears nothing (wear read failed):', e instanceof Error ? e.message : e); return []; }
};

// Wear must never cost a player a payment. Two kills settling close together can read the same wear and write the same `wear:<piece>:<seq>`; the second batch then aborts
// (O0001) although it is NOT a replay. So: when the settle did not commit because of a wear-seq clash (the kill's OWN event is not stored), re-read the wear and retry ONCE with a fresh
// seq; if that clashes too, settle WITHOUT the wear line (a missed bit of wear is fine, a missed payment is not). A genuine replay (the kill's own event exists) is rethrown untouched.
export async function settleWithWear<T>(o: { db: Db; account: string; ownEventId: string; wear: () => Promise<store.Json[]>; commit: (wear: store.Json[]) => Promise<T> }): Promise<T> {
  let lines = await o.wear().catch(() => [] as store.Json[]);
  for (let attempt = 0; ; attempt++) {
    try { return await o.commit(lines); }
    catch (e) {
      const clash = lines.length > 0 && e instanceof DbError && e.code === 'O0001' && (await store.event(o.db, o.account, o.ownEventId)) === null;
      if (!clash) throw e;
      lines = attempt === 0 ? await o.wear().catch(() => [] as store.Json[]) : [];
    }
  }
}
