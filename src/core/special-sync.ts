// The special slots follow the account (Dom 2026-10-20, Backend #3422): a signed-in page reads its character's slots once at sign-in and sends every pick it makes. The device's localStorage stays the cache the buttons read
// (special-equip.ts), so a guest, an offline writer or a 503 (the migration not applied yet) leaves the pick exactly where it was.
import { adoptSpecialSlots, devicePicks, useSpecialPush } from './special-equip.ts';
import { getSpecialSlots, setSpecialSlots, slotsOffline } from './special-net.ts';
import type { Opts } from './writer-call.ts';

/** Read the account's slots at sign-in. The server's pair replaces the device cache; a server with nothing stored takes the device's picks up (a pick made as a guest or before the account held any) and keeps them; an unanswered writer changes nothing. */
export async function pullSpecialSlots(token: string | null, character: string, opts: Opts = {}): Promise<'adopted' | 'pushed' | 'kept'> {
  const got = await getSpecialSlots(token, character, opts);
  if (slotsOffline(got)) return 'kept';
  if (got.slot1 !== null || got.slot2 !== null) { adoptSpecialSlots([got.slot1, got.slot2]); return 'adopted'; }
  const local = devicePicks();
  if (!local.some((id) => id !== undefined)) return 'kept';
  const sent = await setSpecialSlots(token, character, [local[0] ?? null, local[1] ?? null], opts);
  return slotsOffline(sent) ? 'kept' : 'pushed';
}

/** After sign-in: every pick made on this page is sent to the writer as the final pair (one write per swap). `token` and `character` are read at the moment of the pick, so a session that has since ended sends nothing. */
export function pushSpecialSlotsOnPick(token: () => string | null, character: () => string | null | Promise<string | null>, opts: Opts = {}): void {
  useSpecialPush((picks) => { void (async () => { const t = token(), c = t ? await character() : null; if (t && c) await setSpecialSlots(t, c, picks, opts); })(); });
}
