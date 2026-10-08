// Position save (TOP10 row 3, Dom 2026-10-08): presence posts what it SAW to the writer's POST /internal/location (origins/server/location.ts) on leave, on a
// zone change and every 5 minutes. Only the place is saved this way; valuables save at once in their own transaction (Dom's 08:37 rule). Donors: EverQuest's
// save on zone change and camp, Ultima Online / ModernUO's 5-minute world save; in both the server saves and the client only moves (#1775 sends no "save").
// Fire-and-forget behind ONE bounded queue: one post in flight at a time, the newest position per account replaces an older queued one, and the oldest account
// is dropped past `max`, so a slow or dead writer can never grow presence's memory or stall its tick. A failed post is logged and not retried: the next
// checkpoint or leave carries a newer place anyway.
export type SaveAt = { x: number; z: number; atMs: number };
export type SaveFn = (account: string, at: SaveAt) => Promise<unknown>;
export const SAVE_EVERY_MS = 5 * 60_000;   // Dom's cadence (tunable to 10 min); the writer keeps only the newest row per character
export const SAVE_QUEUE_MAX = 10_000;      // = RULES.memoryMax: at most one queued place per remembered account

export function saveQueue(save: SaveFn, log: (line: string) => void = console.log, max = SAVE_QUEUE_MAX) {
  const pending = new Map<string, SaveAt>();   // account -> newest place, oldest account first
  let busy = false, failed = 0, sent = 0;
  const drain = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      for (let next = pending.entries().next(); !next.done; next = pending.entries().next()) {
        const [account, at] = next.value;
        pending.delete(account);
        try { await save(account, at); sent++; } catch (e) { failed++; log(`presence: position save for ${account.slice(0, 8)} failed (${(e as Error).message}); the next checkpoint carries a newer place`); }
      }
    } finally { busy = false; }
  };
  return {
    push(account: string, at: SaveAt): void {
      pending.delete(account); pending.set(account, at);
      if (pending.size > max) pending.delete(pending.keys().next().value!);
      void drain();
    },
    // A character switch (/internal/rejoin): the account's queued place belongs to the OLD character, and the writer stores a post on whichever character is
    // active when it arrives, so it must not be sent. A post already in flight (at most the 1.5 s timeout) is not recalled: the writer-side `at` guard is the follow-up.
    drop(account: string): void { pending.delete(account); },
    idle: (): boolean => !busy && pending.size === 0,
    stats: () => ({ queued: pending.size, sent, failed }),
  };
}
