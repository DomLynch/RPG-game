// The client half of POST /origins/ground_state and /ground_take (origins/server/ground-take.ts). A body names a character and an instance only: never an item, a quantity or a position (the server decides reach).
// Same contract as shop-net.ts: any failure is an answer ({ offline, code? }), never a throw. `code` is the writer's refusal id (taken, have-it, full, away, unchecked, stale, off).
import { call, type Offline, type Opts } from '../../src/core/index.ts';

export type GroundRow = { instance: string; item: string; zone: string; place: string; offsetX?: number; offsetZ?: number; radiusM: number; available: boolean; visible: boolean };
export type GroundState = { items: GroundRow[] };
export type GroundTaken = { instance: string; item: string; qty: number };

export function stateOf(r: unknown): GroundState | null {
  const v = r as { items?: unknown } | null;
  if (!v || !Array.isArray(v.items)) return null;
  const items: GroundRow[] = [];
  for (const x of v.items as Record<string, unknown>[]) {
    if (!x || typeof x.instance !== 'string' || typeof x.item !== 'string' || typeof x.zone !== 'string' || typeof x.place !== 'string' || typeof x.radiusM !== 'number' || !(x.radiusM > 0) || typeof x.available !== 'boolean' || typeof x.visible !== 'boolean') return null;
    if ((x.offsetX === undefined) !== (x.offsetZ === undefined) || (x.offsetX !== undefined && (typeof x.offsetX !== 'number' || typeof x.offsetZ !== 'number'))) return null;
    items.push({ instance: x.instance, item: x.item, zone: x.zone, place: x.place, ...(x.offsetX !== undefined ? { offsetX: x.offsetX as number, offsetZ: x.offsetZ as number } : {}), radiusM: x.radiusM, available: x.available, visible: x.visible });
  }
  return { items };
}
export const takenOf = (r: unknown): GroundTaken | null => {
  const v = r as { result?: unknown; instance?: unknown; item?: unknown; qty?: unknown } | null;
  return v && v.result === 'taken' && typeof v.instance === 'string' && typeof v.item === 'string' && Number.isSafeInteger(v.qty) ? { instance: v.instance, item: v.item, qty: v.qty as number } : null;
};
export const readGround = (token: string | null, opts: Opts = {}): Promise<GroundState | Offline> => call('ground_state', {}, token, stateOf, opts);
export const takeGround = (token: string | null, character: string, instance: string, opts: Opts = {}): Promise<GroundTaken | Offline> => call('ground_take', { character, instance }, token, takenOf, opts);
