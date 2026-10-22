// The world-marks settler (docs/specs/origins/pit-live-zone.md, Lead ruling 2026-10-22 "B"; migration 20261022100000): a Dungeon gate-boss kill is a ladder mark, decided on the WHOLE damage ledger of the kill
// once its join window has closed, so it never depends on who reported first (ModernUO decides who qualified at death, relative to the top damager). Once a minute (worldMarks.everyS) the writer asks the database
// to settle the closed kills; the database does the arithmetic and the cap, this file only supplies the rows. Idempotent by the database's own keys; the migration not applied answers null, never an error.
// Not tied to the spawn janitor: that one needs the layers flag and presence, and a settle needs neither.
import type { Db } from './db.ts';
import * as store from './store.ts';
import { betaMarks, MAX_LEVEL } from '../../src/core/server.ts';
import { MS_PER_SECOND } from './units.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const MARKS = SERVER_RULES.worldMarks[0]!, SHARE = SERVER_RULES.worldShare[0]!;
/** The seconds a kill waits before it settles: its join window (a late joiner is still in the ledger) plus the grace rows. */
export const SETTLE_WAIT_S = SHARE.joinWindowS + MARKS.graceS;
/** The most TOTAL marks (claims + world marks) the beta cut allows: the same cut the client and awards.ts read (level = 1 + marks). */
export const MARKS_CAP: number = betaMarks(MAX_LEVEL);

export type MarksSettler = { settle(): Promise<number | null>; start(): void; stop(): void };

export function createMarksSettler(db: Db, everyMs: number = MARKS.everyS * MS_PER_SECOND, log: (m: string) => void = (m) => console.error(m)): MarksSettler {
  let timer: NodeJS.Timeout | undefined, busy = false;
  async function settle(): Promise<number | null> {
    if (busy) return null;   // one settle at a time: a slow database never stacks them
    busy = true;
    try {
      const n = await store.worldMarksSettle(db, SETTLE_WAIT_S, MARKS.ofTop, MARKS_CAP, MARKS.batch);
      if (n !== null && n > 0) log(`origins-writer world marks: settled ${n} ladder mark${n === 1 ? '' : 's'} (kills older than ${SETTLE_WAIT_S} s, qualify at ${MARKS.ofTop} of the top, cap ${MARKS_CAP} total marks)`);
      return n;
    } catch (e) { log(`origins-writer world marks: skipped, nothing settled: ${e instanceof Error ? e.message : String(e)}`); return null; }
    finally { busy = false; }
  }
  return {
    settle,
    start() { if (!timer) { timer = setInterval(() => { void settle(); }, everyMs); timer.unref(); } },
    stop() { if (timer) clearInterval(timer); timer = undefined; },
  };
}
