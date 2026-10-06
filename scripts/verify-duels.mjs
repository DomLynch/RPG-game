// Sweep for duel results (Backend; duel step 2): the daily verifier's shape (verify-daily.mjs) over rooms instead of daily rows. For each
// room with reports pending, both pages' claims and uploaded PvpRecords go through src/net/verify-duel.ts. A room that replays clean from
// both records is verified; one that does not is flagged (never deleted, like a refused daily row) with the reason; a room with only one
// record stays unverified (no reward, no pass) and is only listed in the receipt, since the other page's record may still arrive.
// `db` is { pending(limit): { room, claims, createdAt }[], verify(room), flag(room, reason), unverify(room, reason) }. `pending` must return the
// rooms not yet marked, OLDEST FIRST (createdAt in ms), so a backlog is worked in order. A room still one-record after UNVERIFIED_AFTER_MS is
// marked unverified (unverify) and leaves the queue: six hours is far past the point any page uploads its record (a settled report posts its
// record within seconds; the relay token lives 30 min + 5 and duel_reports rows are deleted after a day), so a second record that has not come
// by then is not coming, and 200 such rooms cannot fill every sweep. Still no reward, never a pass. The adapters (psql/REST) and the record
// column they read arrive with the schema change after fight_results is applied; this file has no database of its own. `dry` replays without writing.
import { verifyDuel } from '../src/net/verify-duel.ts';

const LIMIT = 200;
export const UNVERIFIED_AFTER_MS = 6 * 60 * 60 * 1000;

export async function verifyRooms(db, { dry = false, now = Date.now() } = {}) {
  const rooms = await db.pending(LIMIT);
  /** @type {{ checked: number, verified: number, flagged: { room: string, reason: string }[], unverified: { room: string, reason: string }[], agedOut: number, dry: boolean }} */
  const receipt = { checked: rooms.length, verified: 0, flagged: [], unverified: [], agedOut: 0, dry };
  for (const { room, claims, createdAt } of rooms) {
    // One room's garbage must never stop the sweep: anything that throws is that room's flag.
    let verdict;
    try { verdict = claims.length === 2 ? verifyDuel(claims) : { ok: false, unverified: true, reason: `${claims.length} claim(s) for the room` }; }
    catch (error) { verdict = { ok: false, unverified: false, reason: `the verifier could not read the room: ${error instanceof Error ? error.message : String(error)}` }; }
    if (verdict.ok) { if (!dry) await db.verify(room); receipt.verified++; }
    else if (verdict.unverified) {
      receipt.unverified.push({ room, reason: verdict.reason });
      if (Number.isFinite(createdAt) && now - createdAt > UNVERIFIED_AFTER_MS) { receipt.agedOut++; if (!dry) await db.unverify(room, verdict.reason); }
    } else { receipt.flagged.push({ room, reason: verdict.reason }); if (!dry) await db.flag(room, verdict.reason); }
  }
  return receipt;
}
