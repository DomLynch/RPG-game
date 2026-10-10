// A zone kill the server verified answers with the CP it paid ({ cp, bronze, loot }, origins/server/world-spawns.ts kill_report). The saved career on screen must move with it: Dom's first paid kill
// (2026-10-09 20:42) left "0 / 1000 CP" on his screen because the page dropped that answer and only re-read the career on the next open. Pure: the page hands in its session and its save source.
import type { PitSession } from '../pit/pit.ts';
import type { Killed } from './spawn-net.ts';
import type { Offline } from './save.ts';
import type { CareerState } from '../progression/model.ts';

export type Source = { saved: CareerState } | { offline: string };
/** The session and source after the server's paid CP, or null when there is nothing to show (offline, not a saved career, a kill that paid 0, or no server answer). */
export function applyServerKill<S extends Source>(session: PitSession, source: S, killed: Killed | Offline): { session: PitSession; source: Source; cp: number } | null {
  if ('offline' in killed || !('saved' in source) || killed.cp <= 0) return null;
  const credit = (c: CareerState): CareerState => ({ ...c, credit: c.credit + killed.cp });
  return { session: { ...session, career: credit(session.career) }, source: { saved: credit(source.saved) }, cp: killed.cp };
}
/** The kill toast. A signed-in kill (a saved career and a server answer) shows only what the server paid ("+20 CP · +3 bronze · Wolf pelt ×2"); a guest or offline page shows the page's own numbers, labelled preview. */
export function killToast(source: Source, killed: Killed | Offline, local: string, name: (id: string) => string): string {
  if ('offline' in killed || !('saved' in source)) return `${local} (preview)`;
  const loot = killed.loot.map((l) => (l.quantity > 1 ? `${name(l.item)} ×${l.quantity}` : name(l.item)));
  const paid = [...(killed.cp ? [`+${killed.cp} CP`] : []), ...(killed.bronze ? [`+${killed.bronze} bronze`] : []), ...loot];
  return paid.length ? paid.join(' · ') : 'Down. Nothing paid.';
}
