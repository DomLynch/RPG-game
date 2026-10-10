// The engine's gear screen over the ONE item ledger: the page's client for Backend's gear_open / gear_equip / gear_unequip (origins/server/gear.ts, #1982). `call` is the same
// POST helper the fight and spawn clients use (encounter-net.ts): no DOM, storage or clock here, and every failure (no session, a 422 refusal, a timeout, the network, a reply that is not the
// documented shape) is an answer ({ offline }), never a throw, so the sheet keeps what it was showing. The pure half (the reply as the sheet's Loot, an op as the calls that make it) is src/core/gear-ledger.ts.
import { stepsFor, viewOf, type GearOp, type GearView } from './gear-ledger.ts';
import { call, type Offline } from './writer-call.ts';
import type { Loot } from './loot.ts';

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
// The ONE-TIME migration of this device's local ledger (gear_import, origins/server/gear-import.ts): everything it owns (worn, pack, bank), the paperdoll it wore and the rung each piece was taken at.
// The server mints one copy per piece per account, ever, so asking again adds only the difference and removes nothing.
export type ImportBody = { owned: string[]; equipped: Record<string, string>; tiers: Record<string, number> };
export type ImportReceipt = { imported: string[]; alreadyHeld: string[]; skipped: unknown[]; worn: string[]; bank: string[]; unworn: unknown[]; replayed: boolean };
export function importBodyOf(loot: Loot | undefined): ImportBody | null {
  if (!loot || (!loot.owned.length && !Object.keys(loot.equipped).length)) return null;
  const tiers: Record<string, number> = {}, equipped: Record<string, string> = {};
  for (const [id, p] of Object.entries(loot.taken ?? {})) if (typeof p?.tier === 'number') tiers[id] = p.tier;
  for (const [doll, id] of Object.entries(loot.equipped)) if (typeof id === 'string') equipped[doll] = id;
  return { owned: [...new Set<string>([...loot.owned, ...(loot.pack ?? [])])].slice(0, 200), equipped, tiers };
}
const receiptOf = (r: unknown): ImportReceipt | null => (r && typeof r === 'object' && Array.isArray((r as ImportReceipt).imported) && Array.isArray((r as ImportReceipt).alreadyHeld) ? (r as ImportReceipt) : null);
export const importGear = (token: string | null, character: string, body: ImportBody, opts: Opts = {}) => call('gear_import', { character, ...body }, token, receiptOf, opts);
