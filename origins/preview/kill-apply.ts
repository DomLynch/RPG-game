// A zone kill the server verified answers with the CP it paid ({ cp, bronze, loot }, origins/server/world-spawns.ts kill_report). The saved career on screen must move with it: Dom's first paid kill
// (2026-10-09 20:42) left "0 / 1000 CP" on his screen because the page dropped that answer and only re-read the career on the next open. Pure: the page hands in its session and its save source.
import type { PitSession } from '../pit/pit.ts';
import type { Killed, ReceiptNote } from './spawn-net.ts';
import type { Offline } from './save.ts';
import type { CareerState } from '../../src/core/index.ts';
import type { GuestLoot } from './guest-loot.ts';
import TEXT from './kill-text.json' with { type: 'json' };
import { defeatedLine, rewardLine, type KillCopy } from './legend-copy.ts';

export type Source = { saved: CareerState } | { offline: string };
/** The session and source after the server's paid CP, or null when there is nothing to show (offline, not a saved career, a kill that paid 0, or no server answer). */
export function applyServerKill<S extends Source>(session: PitSession, source: S, killed: Killed | Offline): { session: PitSession; source: Source; cp: number } | null {
  if ('offline' in killed || !('saved' in source) || killed.cp <= 0) return null;
  const credit = (c: CareerState): CareerState => ({ ...c, credit: c.credit + killed.cp });
  return { session: { ...session, career: credit(session.career) }, source: { saved: credit(source.saved) }, cp: killed.cp };
}
/** The quiet note for a report the writer answered 409 with a `kind` (launch gate V5): 'paid' shows the STORED receipt (the career on screen is not credited again: a reloaded page already read it from the server), 'expired' / 'unknown' say the report is closed. Copy is a row (kill-text.json). */
export function receiptToast(n: ReceiptNote): string {
  if (n.kind !== 'paid') return TEXT.toast.receiptClosed;
  const r = n.receipt;
  if (!r) return TEXT.toast.receiptPaidNothing;
  const paid = [...(r.cp ? [TEXT.toast.receiptCp.replace('{n}', String(r.cp))] : []), ...(r.bronze ? [TEXT.toast.receiptBronze.replace('{n}', String(r.bronze))] : []), ...(r.loot ? [(r.loot === 1 ? TEXT.toast.receiptItemOne : TEXT.toast.receiptItemMany).replace('{n}', String(r.loot))] : [])];
  return paid.length ? TEXT.toast.receiptPaid.replace('{paid}', paid.join(' · ')) : TEXT.toast.receiptPaidNothing;
}
/** Whether a zone's kills are reported to the writer: not from an UNLISTED zone (the server cannot know it: no engage token, nothing to verify or pay), so the page sends no kill_report there at all (Strategy 2026-10-18). */
export const reportsKills = (zone: { readonly unlisted?: boolean }): boolean => zone.unlisted !== true;
export const SIGN_IN_TO_KEEP = TEXT.toast.guestNoLoot, NOT_SAVED = TEXT.toast.notSaved;
/** The one plain line beside a guest's "Sign in" link, shown only while the guest holds something (SCOPE guest acceptance item 4): signing in is a page navigation and a guest's loot is an unverified, session-only roll (guest-loot.ts), so it is NOT carried over; the player is told before the tap. */
export const GUEST_SIGN_IN_LOSS = TEXT.guest.signInLoss;
const lines = (loot: readonly { item: string; quantity: number }[], name: (id: string) => string): string[] => loot.map((l) => (l.quantity > 1 ? `${name(l.item)} ×${l.quantity}` : name(l.item)));
/** The kill toast: ONE path. What the server paid ("Wolf is down. +20 CP · +3 bronze · Wolf pelt ×2. Bounty done."); a guest (no session) is shown what the same table rolled for this session with a nudge to sign in to keep it ("Wolf pelt ×2 (sign in to keep it).", guest-loot.ts; no CP, nothing saved), and with nothing rolled gets the plain nudge; a signed-in page the server did not answer is told nothing was saved. "Bounty done." is the journal step's own answer (the server pays no bounty bronze yet). The copy is a row (kill-text.json). */
export function killToast(killed: Killed | Offline, name: (id: string) => string, creature: string, bountyTaken = false, guest: GuestLoot | null = null, sandbox = false, copy: KillCopy | null = null, ladder = false): string {
  const done = bountyTaken ? ' Bounty done.' : '', pending = ladder ? ` ${TEXT.toast.ladderPending}` : '';   // ladder: the killed spawn row says `roster` (a ladder roster kill is a ladder win the writer settles within a minute, origins/server/world-marks.ts): only a kill the server took shows it, never a guest's or an unsaved one
  const head = copy ? defeatedLine(copy, creature) : `${creature} is down.`;   // a Pit legend (legend-copy.ts) is "defeated" and its reward is "Reward: ...", on its own line; every other creature keeps its words
  if (sandbox) return `${TEXT.toast.sandboxKill.replace('{creature}', creature)}${done}`;   // an UNLISTED zone (the Test Zone): the server never sees it, so nothing is paid or saved there, and the row says so
  if ('offline' in killed && killed.offline === 'http-409' && killed.kind) return `${head} ${receiptToast({ kind: killed.kind, instance: '', ...(killed.receipt ? { receipt: killed.receipt } : {}) })}${done}${pending}`;   // the first send's own 409 reads the same way
  if ('offline' in killed) {
    const held = killed.offline === 'no-session' && guest ? [...(guest.bronze ? [`+${guest.bronze} bronze`] : []), ...lines(guest.loot, name)] : [];
    return `${head} ${held.length ? TEXT.toast.guestLoot.replace('{paid}', held.join(' · ')) : killed.offline === 'no-session' ? SIGN_IN_TO_KEEP : NOT_SAVED}${done}`;
  }
  const paid = [...(killed.cp ? [`+${killed.cp} CP`] : []), ...(killed.bronze ? [`+${killed.bronze} bronze`] : []), ...lines(killed.loot, name)];
  if (copy) return `${head}\n${rewardLine(copy, paid)}${done}${pending}`;
  return `${head} ${paid.length ? `${paid.join(' · ')}.` : 'Nothing paid.'}${done}${pending}`;
}
