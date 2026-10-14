// Item 25 (top-30 programme, Wave A2): presence posts one location per account every 60 s and on leave; written one by one that is a psql round trip (about 130 ms to Supabase) each.
// The dirty map keeps the LATEST observation per account and a timer writes the whole map as ONE statement, one round trip for N accounts. The database function is the same
// origins_save_location the write-through path calls (active character, newest-wins on updated_at), so a late or repeated flush cannot move a position backwards or pay twice.
import type { Db } from './db.ts';
import * as store from './store.ts';

export type Observation = { x: number; z: number; zone: string | null; atMs: number };
export type LocationFlusher = {
  mark(account: string, at: Observation): void;
  has(account: string): boolean;
  drop(account: string): void;
  size(): number;
  flush(): Promise<{ rows: number; batches: number }>;
  start(): void;
  stop(): Promise<void>;
};

// One round trip: every row through the one-row function, in a single statement.
const MANY = `select count(*) from jsonb_to_recordset(:'rows'::jsonb) as r(a uuid, x int, z int, zone text, t bigint), lateral public.origins_save_location(r.a, r.x, r.z, r.zone, r.t);`;

export function createLocationFlusher(db: Db, everyMs: number, log: (m: string) => void = m => console.error(m)): LocationFlusher {
  if (!Number.isInteger(everyMs) || everyMs <= 0) throw new Error('location flusher: everyMs must be a positive integer');
  let dirty = new Map<string, Observation>();
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<{ rows: number; batches: number }> | null = null;

  const put = (m: Map<string, Observation>, account: string, at: Observation) => { const had = m.get(account); if (!had || at.atMs >= had.atMs) m.set(account, at); };

  async function once(): Promise<{ rows: number; batches: number }> {
    if (dirty.size === 0) return { rows: 0, batches: 0 };
    const taken = dirty; dirty = new Map();
    const rows = [...taken].map(([a, o]) => ({ a, x: o.x, z: o.z, zone: o.zone, t: o.atMs }));
    try {
      await db.run(MANY, { rows: JSON.stringify(rows) });
      return { rows: rows.length, batches: 1 };
    } catch (e) {
      // One refused row must not hold every other account's spot hostage: write the rows one by one, drop only the ones the database itself refuses, keep the rest dirty on a lost connection.
      log(`origins-writer location flush: batch of ${rows.length} failed (${e instanceof Error ? e.message : e}); retrying row by row`);
      let batches = 1;
      for (const [account, o] of taken) {
        try { batches++; await store.saveLocation(db, account, o); }
        catch (e2) { log(`origins-writer location flush: ${account}: ${e2 instanceof Error ? e2.message : e2}`); put(dirty, account, o); }
      }
      return { rows: rows.length, batches };
    }
  }

  // Overlapping flushes (the timer, a read-your-writes flush, shutdown) queue behind one another, never run side by side.
  const flush = () => (running = (running ?? Promise.resolve({ rows: 0, batches: 0 })).catch(() => ({ rows: 0, batches: 0 })).then(once));

  return {
    mark: (account, at) => put(dirty, account, at),
    has: account => dirty.has(account),
    drop: account => { dirty.delete(account); },
    size: () => dirty.size,
    flush,
    start() { if (!timer) { timer = setInterval(() => { flush().catch(() => undefined); }, everyMs); timer.unref(); } },
    async stop() { if (timer) clearInterval(timer); timer = undefined; await flush(); },
  };
}
