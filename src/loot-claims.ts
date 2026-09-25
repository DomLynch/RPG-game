import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoragePort } from './profile.ts';
import { readStanding, type Standing } from './cloud-profile.ts';

// The claims outbox (SCOPE 9(a), Backend's contract 2026-09-25): every signed-in ladder win posts one loot_claims row (migration
// 202609230001), and the verifier replays its record and awards the mark and the piece. An entry is written AT THE KILL, tagged with
// the account that won, so a closed tab still claims the win. It becomes final on the player's last word on the loot — a take once
// the Undo line is gone, Leave it, or nothing left to offer — and only final entries are posted. A non-final entry found at the next
// load or fight is made final with no piece (settleClaims). Posts go on sign-in, on a page load and on the final word; never in a loop.
export type Claim = { userId: string; opponent: string; record: string; piece: string | null; final: boolean };
export const CLAIMS_KEY = 'frankendom.claims.v1';
export const CLAIMS_CAP = 10;
// Share stays hidden until the win's claim has been posted, or this long: the record hash is first-claimer-wins, so a link shared
// before the post lands would let whoever opens it claim the fight.
export const CLAIM_WAIT_MS = 3000;
// The DB's own checks on a claim (loot_claims): an entry that fails one could only ever be refused, so it is never stored.
const OPPONENT = /^[a-z]{1,32}$/, PIECE = /^[a-z]{1,32}\.[A-Za-z]{1,32}$/, RECORD = /^[A-Za-z0-9_-]+$/;
const isClaim = (value: unknown): value is Claim => {
  const c = value as Claim;
  return !!c && typeof c.userId === 'string' && !!c.userId && typeof c.opponent === 'string' && OPPONENT.test(c.opponent)
    && typeof c.record === 'string' && RECORD.test(c.record) && (c.piece === null || (typeof c.piece === 'string' && PIECE.test(c.piece))) && typeof c.final === 'boolean';
};
export function loadClaims(storage: StoragePort): Claim[] {
  try { const value: unknown = JSON.parse(storage.getItem(CLAIMS_KEY) ?? '[]'); return Array.isArray(value) ? value.filter(isClaim) : []; } catch { return []; }
}
export function saveClaims(storage: StoragePort, claims: Claim[]): void {
  try { storage.setItem(CLAIMS_KEY, JSON.stringify(claims)); } catch { /* storage unavailable: the win stays on the device's marks */ }
}
// One entry per fight (its record); past the cap the oldest unfinished entry goes first, else the oldest.
export function addClaim(claims: Claim[], claim: Claim): Claim[] {
  const next = [...claims.filter((c) => c.record !== claim.record), claim];
  while (next.length > CLAIMS_CAP) { const open = next.findIndex((c) => !c.final); next.splice(open >= 0 ? open : 0, 1); }
  return next;
}
export const finalClaim = (claims: Claim[], record: string, piece: string | null): Claim[] =>
  claims.map((c) => (c.record === record && !c.final ? { ...c, piece, final: true } : c));
export const settleClaims = (claims: Claim[]): Claim[] => claims.map((c) => (c.final ? c : { ...c, piece: null, final: true }));
// What the account has won on this device and the server does not hold yet: the rank and the loot offer add it to my_standing()'s pending.
export const pendingClaims = (claims: Claim[], userId: string | null): Claim[] => (userId ? claims.filter((c) => c.userId === userId) : []);

// Post one claim. Only an answer that can never change drops it: 23505 (this fight is already claimed) and 23514 (it fails a check and
// never will pass; reported). Everything else keeps it for the next sign-in or load — 42501 (the hourly cap, or RLS before the apply),
// PGRST205/404 (the table is not there yet) and the network. user_id is the server's (auth.uid()) and is never sent.
export async function postClaim(db: SupabaseClient, claim: Claim, report: (error: unknown) => void): Promise<'drop' | 'keep'> {
  try {
    const { error } = await db.from('loot_claims').insert({ opponent: claim.opponent, piece: claim.piece, record: claim.record });
    if (!error || error.code === '23505') return 'drop';
    if (error.code === '23514') { report(error); return 'drop'; }
    return 'keep';
  } catch { return 'keep'; }
}
// Post this account's final entries one at a time, stopping at the first one kept; another account's entries are never posted.
// Flushes are chained, so a sign-in and a final word landing together never post the same entry twice. Resolves to how many left.
let flushing: Promise<number> = Promise.resolve(0);
export function flushClaims(db: SupabaseClient, userId: string, storage: StoragePort, report: (error: unknown) => void): Promise<number> {
  flushing = flushing.then(async () => {
    let left = 0;
    for (const claim of loadClaims(storage).filter((c) => c.final && c.userId === userId)) {
      if (await postClaim(db, claim, report) === 'keep') break;
      saveClaims(storage, loadClaims(storage).filter((c) => c.record !== claim.record)); left++;
    }
    return left;
  }, () => 0);
  return flushing;
}
// A flush, then the standing to draw. An entry that left the outbox must already be in my_standing()'s pending when the rank redraws,
// or the rank dips by one until the sweep settles it (Lead's blocker, 2026-09-26): so after any post the standing is read again first.
export async function flushThenStanding(db: SupabaseClient, userId: string, storage: StoragePort, report: (error: unknown) => void, current: Standing | null): Promise<Standing | null> {
  return (await flushClaims(db, userId, storage, report)) ? readStanding(db) : current;
}
