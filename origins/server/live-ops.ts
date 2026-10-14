// The writer's live-ops state (top-30 item 28): the scheduled-event and kill-switch rows, read from the database once a minute (AzerothCore's game_event pattern: one table, one periodic
// tick) and held in memory. A failed read keeps the last good rows (a database blip must not flip every switch back on or end a running event); a writer that has never read one starts on the
// defaults, which are: no events, every switch on. Rows the shared loader refuses are dropped and logged (src/core/live-ops.ts).
import { activeEvents, EMPTY_LIVE_OPS, loadLiveOps, switchOn, type LiveEvent, type LiveOps } from '../../src/core/server.ts';
import type { Db } from './db.ts';
import * as store from './store.ts';

export type LiveOpsState = {
  switchOn(key: string): boolean;
  active(): LiveEvent[];
  snapshot(): { at: number | null; events: LiveEvent[]; active: string[]; switches: Record<string, boolean>; rejected: number };
  refresh(): Promise<void>;
  start(): void;
  stop(): void;
};

export function createLiveOps(db: Db, everyMs = 60_000, now: () => number = Date.now, log: (m: string) => void = m => console.error(m)): LiveOpsState {
  let ops: LiveOps = EMPTY_LIVE_OPS, at: number | null = null, rejected = 0, timer: NodeJS.Timeout | undefined;
  async function refresh(): Promise<void> {
    try {
      const raw = await store.liveOps(db);
      const loaded = loadLiveOps(raw === 'absent' ? {} : raw);
      for (const r of loaded.rejected) log(`origins-writer live-ops: ${r.table} ${r.id}: ${r.why} (row ignored)`);
      ops = loaded.ops; rejected = loaded.rejected.length; at = now();
    } catch (e) { log(`origins-writer live-ops: read failed, keeping the last rows: ${e instanceof Error ? e.message : e}`); }
  }
  return {
    switchOn: key => switchOn(ops, key),
    active: () => activeEvents(ops, now()),
    snapshot: () => ({ at, events: [...ops.events], active: activeEvents(ops, now()).map(e => e.id), switches: Object.fromEntries(ops.switches), rejected }),
    refresh,
    start() { if (!timer) { void refresh(); timer = setInterval(() => { void refresh(); }, everyMs); timer.unref(); } },
    stop() { if (timer) clearInterval(timer); timer = undefined; },
  };
}
