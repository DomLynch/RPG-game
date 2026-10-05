// Sweep for duel results (Backend; duel step 2): the daily verifier's shape (verify-daily.mjs) over rooms instead of daily rows. For each
// room with reports pending, both pages' claims and uploaded PvpRecords go through src/net/verify-duel.ts. A room that replays clean from
// both records is verified; one that does not is flagged (never deleted, like a refused daily row) with the reason; a room with only one
// record stays unverified (no reward, no pass) and is only listed in the receipt, since the other page's record may still arrive.
// `db` is { pending(limit): { room, claims }[], verify(room), flag(room, reason) }. The adapters (psql/REST) and the record column they read
// arrive with the schema change after fight_results is applied; this file has no database of its own. `dry` replays without writing.
import { verifyDuel } from '../src/net/verify-duel.ts';

const LIMIT = 200;

export async function verifyRooms(db, { dry = false } = {}) {
  const rooms = await db.pending(LIMIT);
  /** @type {{ checked: number, verified: number, flagged: { room: string, reason: string }[], unverified: { room: string, reason: string }[], dry: boolean }} */
  const receipt = { checked: rooms.length, verified: 0, flagged: [], unverified: [], dry };
  for (const { room, claims } of rooms) {
    const verdict = claims.length === 2 ? verifyDuel(claims) : { ok: false, unverified: true, reason: `${claims.length} claim(s) for the room` };
    if (verdict.ok) { if (!dry) await db.verify(room); receipt.verified++; }
    else if (verdict.unverified) receipt.unverified.push({ room, reason: verdict.reason });
    else { receipt.flagged.push({ room, reason: verdict.reason }); if (!dry) await db.flag(room, verdict.reason); }
  }
  return receipt;
}
