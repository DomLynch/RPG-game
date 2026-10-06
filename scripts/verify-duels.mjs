// Sweep for duel results (Backend; duel step 2): the daily verifier's shape (verify-daily.mjs) over rooms instead of daily rows. For each
// room with reports pending, both pages' claims and uploaded PvpRecords go through src/net/verify-duel.ts. A room that replays clean from
// both records is verified; one that does not is flagged (never deleted, like a refused daily row) with the reason; a room with only one
// record stays unverified (no reward, no pass) and is only listed in the receipt, since the other page's record may still arrive.
// `db` is { pending(limit): { room, claims, createdAt, players? }[], verify(room), flag(room, reason), unverify(room, reason), antifarm?: { state(winnerId, loserId), count(room, winnerId, loserId, gain, pay, start, floor) } } (`players` is the two account ids by side; without them or `antifarm` a verified room is only marked). `pending` must return the
// rooms not yet marked, OLDEST FIRST (createdAt in ms), so a backlog is worked in order. A room still one-record after UNVERIFIED_AFTER_MS is
// marked unverified (unverify) and leaves the queue: six hours is far past the point any page uploads its record (a settled report posts its
// record within seconds; the relay token lives 30 min + 5 and duel_reports rows are deleted after a day), so a second record that has not come
// by then is not coming, and 200 such rooms cannot fill every sweep. Still no reward, never a pass. The adapters (psql/REST) and the record
// column they read arrive with the schema change after fight_results is applied; this file has no database of its own. `dry` replays without writing.
import { verifyDuel } from '../src/net/verify-duel.ts';
import { DUEL_ANTIFARM, decideDuelResult } from '../src/net/duel-antifarm.ts';

const LIMIT = 200;
export const UNVERIFIED_AFTER_MS = 6 * 60 * 60 * 1000;
export const REASON_MAX = 300;   // a flag reason is stored text: a hostile record cannot make it long
const clip = (reason) => (reason.length > REASON_MAX ? `${reason.slice(0, REASON_MAX - 1)}…` : reason);

/** `players[side]` is the account that played that side. The winner is the side whose claim says won. */
async function countWin(antifarm, { room, claims, players, now, dry }, receipt) {
  const winnerSide = claims.find((c) => c.won)?.side;
  if (winnerSide !== 0 && winnerSide !== 1) { receipt.skipped.push({ room, reason: 'no winner' }); return; }
  const winnerId = players[winnerSide], loserId = players[1 - winnerSide];
  if (typeof winnerId !== 'string' || typeof loserId !== 'string') { receipt.skipped.push({ room, reason: 'the room names no two accounts' }); return; }
  const state = await antifarm.state(winnerId, loserId);
  const decision = decideDuelResult({ winnerId, loserId, winnerRating: state.winner_rating, loserRating: state.loser_rating, verified: true,
    winnerTodayWins: (state.wins ?? []).map((w) => ({ opponent: w.opponent, at: Number(w.at) })), now });
  if (!decision.counted) { receipt.skipped.push({ room, reason: decision.reason }); return; }
  if (dry || await antifarm.count(room, winnerId, loserId, decision.gain, decision.pay, DUEL_ANTIFARM.elo.start, DUEL_ANTIFARM.elo.floor)) receipt.counted.push({ room, gain: decision.gain, pay: decision.pay });
  else receipt.skipped.push({ room, reason: 'already counted' });
}

export async function verifyRooms(db, { dry = false, now = Date.now() } = {}) {
  const rooms = await db.pending(LIMIT);
  /** @type {{ checked: number, verified: number, flagged: { room: string, reason: string }[], unverified: { room: string, reason: string }[], agedOut: number, counted: { room: string, gain: number, pay: number }[], skipped: { room: string, reason: string }[], writeErrors: { room: string, error: string }[], dry: boolean }} */
  const receipt = { checked: rooms.length, verified: 0, flagged: [], unverified: [], agedOut: 0, counted: [], skipped: [], writeErrors: [], dry };
  for (const { room, claims, createdAt, players } of rooms) {
    // One room's garbage must never stop the sweep: anything that throws is that room's flag.
    let verdict;
    try { verdict = claims.length === 2 ? verifyDuel(claims) : { ok: false, unverified: true, reason: `${claims.length} claim(s) for the room` }; }
    catch (error) { verdict = { ok: false, unverified: false, reason: `the verifier could not read the room: ${error instanceof Error ? error.message : String(error)}` }; }
    const reason = clip(verdict.reason ?? '');
    try {
      if (verdict.ok) {
        // The anti-farm layer (src/net/duel-antifarm.ts) runs on a VERIFIED room only, and BEFORE the room is marked: its write is idempotent per
        // room, so a failure here leaves the room pending and the next sweep counts it once. Rewards are off: `pay` is 0 until PVP_REWARDS is.
        if (db.antifarm && players) await countWin(db.antifarm, { room, claims, players, now, dry }, receipt);
        if (!dry) await db.verify(room);
        receipt.verified++;
      }
      else if (verdict.unverified) {
        receipt.unverified.push({ room, reason });
        // A room with no finite createdAt can never be told apart from a young one, so it counts as aged: it must not sit in the queue forever.
        if (!Number.isFinite(createdAt) || now - createdAt > UNVERIFIED_AFTER_MS) { receipt.agedOut++; if (!dry) await db.unverify(room, reason); }
      } else { receipt.flagged.push({ room, reason }); if (!dry) await db.flag(room, reason); }
    } catch (error) { receipt.writeErrors.push({ room, error: clip(error instanceof Error ? error.message : String(error)) }); }   // one room's failed write must not stall the oldest-first queue behind it
  }
  return receipt;
}
