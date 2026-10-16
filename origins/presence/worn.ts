// What other players see a player wear (Lead's order 2026-10-16, Web's dressing). The set is the writer's own reading of the ACTIVE character's equipped rows
// (origins/server/worn-gear.ts wornIdsOf, the same wornOf the sheet verification uses): presence never takes it from a client. It rides the `enter` record, once per sighting.
// Donor: EQEmu sends the equipment in the spawn struct and an OP_WearChange to nearby clients when it changes; AzerothCore keeps PLAYER_VISIBLE_ITEM_* in the object data and sends a delta.
// A gear change is picked up by a refresh every `wornEveryMs` through ONE bounded queue (the shape of saves.ts): one read in flight, one queued entry per account, never awaited by the
// tick. A failed read keeps the last set. At a full shard (about 200 players / 30 s) that is about 7 reads a second at most, sequential, so the writer never sees a burst from presence.
import type { Worn } from '../server/location.ts';

export type WornRead = (account: string) => Promise<Worn>;
export type WornApply = (account: string, worn: Worn) => void;

/** Equal sets, key order aside (parseWorn sorts, so the join is stable). */
export const sameWorn = (a: Worn, b: Worn): boolean => JSON.stringify(a) === JSON.stringify(b);

export function wornQueue(read: WornRead, apply: WornApply, log: (line: string) => void = console.log) {
  const pending = new Set<string>();   // accounts waiting for a read, oldest first
  let busy = false, failed = 0, read_ = 0;
  const drain = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      for (let next = pending.values().next(); !next.done; next = pending.values().next()) {
        const account = next.value; pending.delete(account);
        try { apply(account, await read(account)); read_++; } catch (e) { failed++; log(`presence: worn read for ${account.slice(0, 8)} failed (${(e as Error).message}); the last set stands`); }
      }
    } finally { busy = false; }
  };
  return {
    push(account: string): void { pending.add(account); void drain(); },
    drop(account: string): void { pending.delete(account); },
    idle: (): boolean => !busy && pending.size === 0,
    stats: () => ({ queued: pending.size, read: read_, failed }),
  };
}
