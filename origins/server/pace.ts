// Pace flag (Lead + Strategy, 2026-10-21): how much slower than real time a verified kill ran. FLAG ONLY: the number rides the kill event's payload so the daily count can set a threshold for the
// refusing min-wall-time check later; nothing is refused here. A client under 20 fps runs the world sim in slow motion (the frame clamp), so wall time grows against sim time.
import { TICKS_PER_SECOND } from './units.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const PACE = SERVER_RULES.pace[0]!;   // slowRatio, minTickS: a row of the pace table

export type Pace = { wallS: number; tickS: number; ratio: number; slow: boolean };

/** The start times of open encounters (token -> ms), bounded: the run view has no created_at, and a flag needs no migration. A restart forgets them (that settle carries no flag). */
export function startLog(keep: number = PACE.startsKept): { note: (token: string, ms: number) => void; take: (token: string) => number | undefined } {
  const at = new Map<string, number>();
  return {
    note: (token, ms) => { at.set(token, ms); while (at.size > keep) at.delete(at.keys().next().value as string); },
    take: (token) => { const ms = at.get(token); at.delete(token); return ms; },
  };
}

/** wallS: seconds from the engagement's start to the report; ticks: the verified record's length. Null when either is unusable or the fight is too short to tell. */
export function paceOf(wallS: number, ticks: number): Pace | null {
  if (!Number.isFinite(wallS) || wallS < 0 || !Number.isInteger(ticks) || ticks < 1) return null;
  const tickS = ticks / TICKS_PER_SECOND;
  if (tickS < PACE.minTickS) return null;
  const ratio = wallS / tickS;
  const cents = (n: number): number => Number(n.toFixed(2));   // two decimals in the event
  return { wallS: cents(wallS), tickS: cents(tickS), ratio: cents(ratio), slow: ratio >= PACE.slowRatio };
}
