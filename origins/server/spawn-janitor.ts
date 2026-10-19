// The spawn janitor (docs/specs/origins/per-layer-spawns.md section 2, migration 20261019170000): presence closes a layer after it has been empty a while, and the spawn rows of a closed layer are dead weight.
// Once a minute (the spawnLayers row) the writer asks presence which layers exist and deletes the spawn rows of every layer that does not. Deleting is safe: a row is only "dead until T", and a layer that comes
// back starts all-alive like any fresh layer. A presence that cannot be asked (down, a malformed answer) deletes NOTHING: "no answer" is never read as "no layer is live". Engages and the beta ledger are never touched.
import type { Db } from './db.ts';
import type { LayersFn } from '../presence/where.ts';
import * as store from './store.ts';
import { MS_PER_SECOND } from './units.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

export type SpawnJanitor = { sweep(): Promise<number | null>; start(): void; stop(): void };

export function createSpawnJanitor(db: Db, layers: LayersFn, everyMs: number = SERVER_RULES.spawnLayers[0]!.janitorEveryS * MS_PER_SECOND, log: (m: string) => void = (m) => console.error(m)): SpawnJanitor {
  let timer: NodeJS.Timeout | undefined, busy = false;
  async function sweep(): Promise<number | null> {
    if (busy) return null;   // one sweep at a time: a slow database never stacks them
    busy = true;
    try {
      const live = await layers();
      const n = await store.spawnLayersSweep(db, live);
      if (n !== null && n > 0) log(`origins-writer spawn janitor: deleted ${n} spawn rows of closed layers (live: ${live.join(',') || 'none'})`);
      return n;
    } catch (e) { log(`origins-writer spawn janitor: skipped, nothing deleted: ${e instanceof Error ? e.message : String(e)}`); return null; }
    finally { busy = false; }
  }
  return {
    sweep,
    start() { if (!timer) { timer = setInterval(() => { void sweep(); }, everyMs); timer.unref(); } },
    stop() { if (timer) clearInterval(timer); timer = undefined; },
  };
}
