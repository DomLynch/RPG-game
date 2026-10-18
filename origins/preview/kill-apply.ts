// A zone kill the server verified answers with the CP it paid ({ cp, bronze, loot }, origins/server/world-spawns.ts kill_report). The saved career on screen must move with it: Dom's first paid kill
// (2026-10-09 20:42) left "0 / 1000 CP" on his screen because the page dropped that answer and only re-read the career on the next open. Pure: the page hands in its session and its save source.
import type { PitSession } from '../pit/pit.ts';
import type { Killed } from './spawn-net.ts';
import type { Offline } from './save.ts';
import { loadRegistry, tableFromFile, type CareerState, type Manifest } from '../../src/core/index.ts';
import SANDBOX_MANIFEST from './sandbox-lines.manifest.json' with { type: 'json' };
import SANDBOX_LINES from './sandbox-lines.json' with { type: 'json' };

export type Source = { saved: CareerState } | { offline: string };
/** The session and source after the server's paid CP, or null when there is nothing to show (offline, not a saved career, a kill that paid 0, or no server answer). */
export function applyServerKill<S extends Source>(session: PitSession, source: S, killed: Killed | Offline): { session: PitSession; source: Source; cp: number } | null {
  if ('offline' in killed || !('saved' in source) || killed.cp <= 0) return null;
  const credit = (c: CareerState): CareerState => ({ ...c, credit: c.credit + killed.cp });
  return { session: { ...session, career: credit(session.career) }, source: { saved: credit(source.saved) }, cp: killed.cp };
}
/** The line a zone the server never sees (unlisted) shows after a kill: the sandbox-lines.json "kill" row, `{creature}` filled in. One loader: the registry's checks, then a line that names the creature. */
export function loadSandboxKillLine(raw: unknown): string {
  const table = tableFromFile(SANDBOX_MANIFEST.tables[0] as Manifest, raw, 'sandbox-lines.json');
  loadRegistry([table]);
  const line = (table.rows as unknown as { id: string; fields: { line?: unknown } }[]).find((r) => r.id === 'kill')?.fields.line;
  if (typeof line !== 'string' || !line.includes('{creature}')) throw new Error('sandbox-lines: the "kill" row is a line that names the {creature}');
  return line;
}
const SANDBOX_KILL = loadSandboxKillLine(SANDBOX_LINES);
export const SIGN_IN_TO_KEEP = 'Sign in to keep loot.', NOT_SAVED = 'Not saved: the server did not answer.';
/** The kill toast: ONE path. What the server paid ("Wolf is down. +20 CP · +3 bronze · Wolf pelt ×2. Bounty done."); a guest (no session) gets no loot and is told to sign in to keep it, a signed-in page the server did not answer is told nothing was saved. "Bounty done." is the journal step's own answer (the server pays no bounty bronze yet). */
export function killToast(killed: Killed | Offline, name: (id: string) => string, creature: string, bountyTaken = false, sandbox = false): string {
  const done = bountyTaken ? ' Bounty done.' : '';
  if (sandbox) return `${SANDBOX_KILL.replace('{creature}', creature)}${done}`;   // a zone the server never sees (unlisted): nothing is paid or saved there, and the row says so
  if ('offline' in killed) return `${creature} is down. ${killed.offline === 'no-session' ? SIGN_IN_TO_KEEP : NOT_SAVED}${done}`;
  const loot = killed.loot.map((l) => (l.quantity > 1 ? `${name(l.item)} ×${l.quantity}` : name(l.item)));
  const paid = [...(killed.cp ? [`+${killed.cp} CP`] : []), ...(killed.bronze ? [`+${killed.bronze} bronze`] : []), ...loot];
  return `${creature} is down. ${paid.length ? `${paid.join(' · ')}.` : 'Nothing paid.'}${done}`;
}
