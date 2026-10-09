// The engine's gear screen over the ONE item ledger: the page's client for Backend's gear_open / gear_equip / gear_unequip (origins/server/gear.ts, #1982). `call` is the same
// POST helper the fight and spawn clients use (encounter-net.ts): no DOM, storage or clock here, and every failure (no session, a 422 refusal, a timeout, the network, a reply that is not the
// documented shape) is an answer ({ offline }), never a throw, so the sheet keeps what it was showing. The pure half (the reply as the sheet's Loot, an op as the calls that make it) is src/gear-ledger.ts.
import { stepsFor, viewOf, type GearOp, type GearView } from '../../src/gear-ledger.ts';
import { call } from './encounter-net.ts';
import type { Offline } from './save.ts';

type Opts = { base?: string; fetch?: typeof fetch; timeoutMs?: number };
export const isOffline = (r: GearView | Offline): r is Offline => 'offline' in r;
export const openGear = (token: string | null, character: string, opts: Opts = {}) => call('gear_open', { character }, token, viewOf, opts);
// One op: its steps in order, each answered with the whole view. The first refusal stops the op and the view is re-read, so the sheet shows what the server holds (a 422 changes nothing server-side).
export async function runOp(token: string | null, character: string, view: GearView, op: GearOp, opts: Opts = {}): Promise<{ view: GearView | Offline; refused: boolean }> {
  let now = view;
  for (const step of stepsFor(view, op)) {
    const next = await call(step.op, { character, id: step.id }, token, viewOf, opts);
    if (isOffline(next)) return { view: await openGear(token, character, opts), refused: true };
    now = next;
  }
  return { view: now, refused: false };
}
