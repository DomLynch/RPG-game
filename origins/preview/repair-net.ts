// The client half of the smith's two ops (origins/server/gear-wear.ts, gear-repair.ts). gear_wear {character}: every worn piece the character holds, with its wear and the quote the smith would charge, priced by the writer's rows;
// an empty list is the answer "nothing is worn". gear_repair {character, op, instance}: repair that piece's wear; the body names no price, tier, slot or wear (the server reads them). Same contract as shop-net.ts: any failure is
// an answer ({ offline }), never a throw, and a failed repair is never retried by the page (a new click is a new op id).
import { call, type Offline, type Opts } from '../../src/core/index.ts';

export type Metal = { item: string; qty: number };
export type WearLine = { instance: string; slot: string; worn: number; max: number; baseMax: number; quote: { points: number; bronze: number; metal: Metal } };
export type Repaired = { instance: string; points: number; cost: { bronze: number; metal: Metal }; piece: { worn: number; max: number; baseMax: number }; replayed: boolean };
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const metalOf = (m: unknown): Metal | null => { const x = m as Partial<Metal> | null; return x && typeof x.item === 'string' && whole(x.qty) ? { item: x.item, qty: x.qty } : null; };

export function wearOf(r: unknown): { pieces: WearLine[] } | null {
  const v = r as { pieces?: unknown } | null;
  if (!v || !Array.isArray(v.pieces)) return null;
  const pieces: WearLine[] = [];
  for (const p of v.pieces as Record<string, unknown>[]) {
    const q = p?.quote as { points?: unknown; bronze?: unknown; metal?: unknown } | undefined, metal = metalOf(q?.metal);
    if (!p || typeof p.instance !== 'string' || typeof p.slot !== 'string' || !whole(p.worn) || !whole(p.max) || !whole(p.baseMax) || !q || !whole(q.points) || !whole(q.bronze) || !metal) return null;
    pieces.push({ instance: p.instance, slot: p.slot, worn: p.worn, max: p.max, baseMax: p.baseMax, quote: { points: q.points, bronze: q.bronze, metal } });
  }
  return { pieces };
}
export function repairedOf(r: unknown): Repaired | null {
  const v = r as { instance?: unknown; points?: unknown; cost?: { bronze?: unknown; metal?: unknown }; piece?: { worn?: unknown; max?: unknown; baseMax?: unknown }; replayed?: unknown } | null, metal = metalOf(v?.cost?.metal);
  if (!v || typeof v.instance !== 'string' || !whole(v.points) || !whole(v.cost?.bronze) || !metal || !whole(v.piece?.worn) || !whole(v.piece?.max) || !whole(v.piece?.baseMax)) return null;
  return { instance: v.instance, points: v.points, cost: { bronze: v.cost!.bronze as number, metal }, piece: { worn: v.piece!.worn as number, max: v.piece!.max as number, baseMax: v.piece!.baseMax as number }, replayed: v.replayed === true };
}
export const readWear = (token: string | null, character: string, opts: Opts = {}): Promise<{ pieces: WearLine[] } | Offline> => call('gear_wear', { character }, token, wearOf, opts);
export const repairPiece = (token: string | null, character: string, instance: string, op: string, opts: Opts = {}): Promise<Repaired | Offline> => call('gear_repair', { character, op, instance }, token, repairedOf, opts);
// A fresh op id per click (8..120 of a-z 0-9 : . _ -, the writer's rule).
export const repairOp = (instance: string, nowMs: number, rand: () => number = Math.random): string => `repair:${instance.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${nowMs.toString(36)}-${Math.floor(rand() * 1e9).toString(36)}`;
// By the status the writer answered (409 stale piece or balance, 422 away / not-worn / funds / metal): the status carries no code the page can read.
export const repairKey = (offline: string): 'offline' | 'stale' | 'refused' | 'failed' => offline === 'no-session' || offline === 'http-401' ? 'offline' : offline === 'http-409' ? 'stale' : offline === 'http-422' ? 'refused' : 'failed';
