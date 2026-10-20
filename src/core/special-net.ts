// The special slots' two ops (Backend #3422: special_slots_get, special_slots_set), browser-safe like build-net.ts: a signed-in player's SPECIAL 1 / SPECIAL 2 picks follow the account. `null` in an answer means nothing stored for that slot
// (the row defaults fill it); `set` sends BOTH slots every time (an omitted or null slot clears it, so a swap is one write). Every failure (no session, a 400, a 503 until the migration is applied, a timeout) is an answer
// ({ offline }), never a throw: the page keeps the device pick it already has.
import { call, type Offline, type Opts } from './writer-call.ts';

export type SlotsView = { slot1: string | null; slot2: string | null };
const slot = (v: unknown): v is string | null => v === null || (typeof v === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(v));
export function slotsOf(result: unknown): SlotsView | null {
  const r = result as { slot1?: unknown; slot2?: unknown } | null;
  return r && typeof r === 'object' && slot(r.slot1 ?? null) && slot(r.slot2 ?? null) ? { slot1: (r.slot1 as string | null | undefined) ?? null, slot2: (r.slot2 as string | null | undefined) ?? null } : null;
}
export const slotsOffline = (r: SlotsView | Offline): r is Offline => 'offline' in r;
export const getSpecialSlots = (token: string | null, character: string, opts: Opts = {}) => call('special_slots_get', { character }, token, slotsOf, opts);
export const setSpecialSlots = (token: string | null, character: string, picks: readonly [string | null, string | null], opts: Opts = {}) => call('special_slots_set', { character, slot1: picks[0], slot2: picks[1] }, token, slotsOf, opts);
