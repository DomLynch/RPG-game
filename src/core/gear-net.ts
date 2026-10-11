// The engine's gear screen over the ONE item ledger: the page's client for Backend's gear_open / gear_equip / gear_unequip (origins/server/gear.ts, #1982). `call` is the same
// POST helper the fight and spawn clients use (encounter-net.ts): no DOM, storage or clock here, and every failure (no session, a 422 refusal, a timeout, the network, a reply that is not the
// documented shape) is an answer ({ offline }), never a throw, so the sheet keeps what it was showing. The pure half (the reply as the sheet's Loot, an op as the calls that make it) is src/core/gear-ledger.ts.
import { stepsFor, viewOf, type GearOp, type GearView } from './gear-ledger.ts';
import { call, type Offline } from './writer-call.ts';

type Opts = { base?: string; fetch?: typeof fetch; timeoutMs?: number };
export const isOffline = (r: GearView | Offline): r is Offline => 'offline' in r;
export const openGear = (token: string | null, character: string, opts: Opts = {}) => call('gear_open', { character }, token, viewOf, opts);
// One op: its steps in order, each answered with the whole view. A refusal stops the op and the view is re-read. A swap is two commits (the occupant comes off, then the piece goes on), so if a
// step AFTER the first is refused (the rank check can refuse the equip), the occupant is put back before the re-read: the slot is never left empty by a refused wear.
export async function runOp(token: string | null, character: string, view: GearView, op: GearOp, opts: Opts = {}): Promise<{ view: GearView | Offline; refused: boolean }> {
  const steps = stepsFor(view, op); let now = view;
  for (const [i, step] of steps.entries()) {
    const next = await call(step.op, { character, id: step.id }, token, viewOf, opts);
    if (isOffline(next)) {
      const first = steps[0];
      if (i > 0 && first?.op === 'gear_unequip') await call('gear_equip', { character, id: first.id }, token, viewOf, opts);   // put the occupant back
      return { view: await openGear(token, character, opts), refused: true };
    }
    now = next;
  }
  return { view: now, refused: false };
}

// The Exchange's bank and smith (origins/server/gear.ts bank_move, upgrade.ts apply_upgrade): the writer decides and answers; the page only asks. bank_move answers the whole view.
export const bankMove = (token: string | null, character: string, id: string, to: 'bank' | 'pack', opts: Opts = {}) => call('bank_move', { character, id, to }, token, viewOf, opts);
export type UpgradeReceipt = { toLevel: number; coin: number; replayed: boolean };
const upgradeOf = (r: unknown): UpgradeReceipt | null => {
  const x = r as { replayed?: unknown; receipt?: { toLevel?: unknown; coin?: unknown } } | null;
  return x && typeof x.replayed === 'boolean' && Number.isInteger(x.receipt?.toLevel) && Number.isInteger(x.receipt?.coin) ? { toLevel: x.receipt!.toLevel as number, coin: x.receipt!.coin as number, replayed: x.replayed } : null;
};
// One piece one level up. The op id is the one-time token: the same piece at the same version asks the same op, so a retry is answered from the stored receipt.
export const upgradePiece = (token: string | null, character: string, piece: { id: string; version: number; level: number }, materials: string[], opts: Opts = {}) =>
  call('apply_upgrade', { character, op: `up:${piece.id}:v${piece.version}`.replace(/[^a-z0-9:._-]/g, '-'), instance: piece.id, toLevel: piece.level + 1, materials }, token, upgradeOf, opts);
