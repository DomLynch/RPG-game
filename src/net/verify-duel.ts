// The PvP verifier's core (Backend; duel step 2): re-derive a duel's result from the two pages' uploaded PvpRecords, headless, through the
// same sim the pages ran (pvpDuel stepped with both intent columns, as RollbackSession.step does). One record proves only that it is
// self-consistent (a cheater can forge both columns into a clean replay), so a room is verified from BOTH pages' records: each must replay to
// the hash and winner its page reported, and the two must agree on both intent columns and both kits, so a column forged on one page
// disagrees with what the other recorded. A room with only one record is unverified: no reward, never a pass. Two accounts forging the
// same fight together still replay clean; that only decorates their own wall, and anti-farm (not here) is what keeps it from paying.
// The claim is what report_duel stored for the page: `side` (0 challenger, 1 guest), `won`, the checkpoint `hash`; `record` is that page's
// PvpRecord or null when it uploaded none. No schema yet: the record column and the sweep's database adapter come with the migration.
import { stepDuel, type Intent, type Side } from '../duel.ts';
import { MAX_RECORD_TICKS, RECORD_VERSION } from '../record.ts';
import { cleanKit, unpackIntents, type PvpRecord } from './pvp.ts';
import { hashDuel, NET, pvpDuel, sameIntent } from './rollback.ts';

export type DuelClaim = { side: Side; won: boolean; hash: string; record: PvpRecord | null };
export type DuelVerdict = { ok: true; winner: Side } | { ok: false; unverified: boolean; reason: string };

type Replay = { winner: Side; hash: string; streams: [Intent[], Intent[]] } | string;

// The winner and the checkpoint fingerprint a record's streams reach: the first checkpoint at or after the first tick that holds the finish
// (RollbackSession.finishedAt / PvpDuel.verdict). A string is the reason the record does not replay to a decided fight.
function replay(record: PvpRecord): Replay {
  try { return replayUnguarded(record); } catch (error) { return `the record does not replay: ${error instanceof Error ? error.message : String(error)}`; }   // an uploaded record is untrusted: nothing in it may throw out of the sweep
}
function replayUnguarded(record: PvpRecord): Replay {
  if (record.v !== RECORD_VERSION) return `record version ${String(record.v)}`;
  if (!Number.isInteger(record.ticks) || record.ticks < 1 || record.ticks > MAX_RECORD_TICKS) return `ticks ${String(record.ticks)} out of range`;
  let streams: [Intent[], Intent[]];
  try { streams = [unpackIntents(record.intents[0]), unpackIntents(record.intents[1])]; } catch { return 'undecodable intents'; }
  if (streams[0].length < record.ticks || streams[1].length < record.ticks) return 'fewer intents than ticks';
  // Both pages put every kit through cleanKit before the duel starts, so an honest record's kits are already clean; anything else is refused.
  if (!Array.isArray(record.kits) || record.kits.length !== 2 || record.kits.some((kit) => JSON.stringify(cleanKit(kit)) !== JSON.stringify(kit))) return 'the kits are not clean kits';
  let duel = pvpDuel(record.kits[0], record.kits[1]), finishedAt: number | null = null, hash: string | null = null;
  for (let t = 1; t <= record.ticks; t++) {
    duel = stepDuel(duel, [streams[0][t - 1], streams[1][t - 1]]);
    if (finishedAt === null && duel.finish) finishedAt = t;
    if (finishedAt !== null && hash === null && t === Math.max(1, Math.ceil(finishedAt / NET.hashEvery)) * NET.hashEvery) { hash = hashDuel(duel); break; }
  }
  if (finishedAt === null) return 'the replay holds no finish';
  if (hash === null) return 'the record ends before the finish checkpoint';
  if (duel.finish!.draw) return 'the replay ends in a draw';
  return { winner: duel.finish!.victim === 1 ? 0 : 1, hash, streams };
}

export function verifyDuel(claims: readonly [DuelClaim, DuelClaim]): DuelVerdict {
  const flag = (reason: string): DuelVerdict => ({ ok: false, unverified: false, reason });
  const [a, b] = claims;
  if (a.side === b.side) return flag('both claims are for the same side');
  if (a.won === b.won) return flag('the claims do not name one winner');
  if (a.hash !== b.hash) return flag('the claims carry different fingerprints');
  if (!a.record || !b.record) return { ok: false, unverified: true, reason: 'only one page uploaded a record' };
  const runs = [replay(a.record), replay(b.record)];
  for (const [i, run] of runs.entries()) if (typeof run === 'string') return flag(`side ${claims[i].side} record: ${run}`);
  const [x, y] = runs as Extract<Replay, object>[];
  if (JSON.stringify(a.record.kits) !== JSON.stringify(b.record.kits)) return flag('the records name different kits');
  for (const column of [0, 1] as const) {
    const n = Math.min(x.streams[column].length, y.streams[column].length, a.record.ticks, b.record.ticks);
    for (let t = 0; t < n; t++) if (!sameIntent(x.streams[column][t], y.streams[column][t])) return flag(`the records disagree on side ${column}'s intent at tick ${t + 1}`);
  }
  for (const [i, run] of [x, y].entries()) {
    const claim = claims[i];
    if (run.hash !== claim.hash) return flag(`side ${claim.side}: the replay's fingerprint is not the reported one`);
    if ((claim.won ? claim.side : 1 - claim.side) !== run.winner) return flag(`side ${claim.side}: the replay's winner is not the reported one`);
  }
  return { ok: true, winner: x.winner };
}
