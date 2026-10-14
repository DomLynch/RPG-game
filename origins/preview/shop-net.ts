// The client half of POST /origins/shop_buy (origins/server/shop-buy.ts). The body carries ids and a quantity only: never a price, cost or stock. Same contract as save.ts: any failure is an answer ({ offline }), never a throw.
import { call, type Offline, type Opts } from '../../src/core/index.ts';
import type { Stock } from '../shops/shop-view.ts';

export type Bought = { shop: string; item: string; quantity: number; cost: number; revision: number; received: string[]; replayed: boolean };
export function boughtOf(r: unknown): Bought | null {
  const b = r as Partial<Bought> | null;
  if (!b || typeof b !== 'object' || typeof b.shop !== 'string' || typeof b.item !== 'string' || !Number.isSafeInteger(b.quantity) || !Number.isSafeInteger(b.cost) || !Number.isSafeInteger(b.revision) || !Array.isArray(b.received)) return null;
  return { shop: b.shop, item: b.item, quantity: b.quantity as number, cost: b.cost as number, revision: b.revision as number, received: b.received.map(String), replayed: b.replayed === true };
}
// One buy of one unit. `op` is the one-time token (a retry with the same op answers from the stored receipt): the caller keeps it until the buy is answered.
export const buyOne = (token: string | null, character: string, shop: string, item: string, revision: number, op: string, opts: Opts = {}): Promise<Bought | Offline> =>
  call('shop_buy', { character, op, shop, item, quantity: 1, revision }, token, boughtOf, opts);
export const newOp = (item: string, nowMs: number, rand: () => number = Math.random): string => `shop:${item.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${nowMs.toString(36)}-${Math.floor(rand() * 1e9).toString(36)}`;
// What the screen says for a refusal, by the HTTP status the writer answered (409 stale list or a changed balance, 422 away / level / stock / funds / closed).
export const refusalKey = (offline: string): 'offline' | 'stale' | 'refused' | 'failed' =>
  offline === 'no-session' || offline === 'http-401' ? 'offline' : offline === 'http-409' ? 'stale' : offline === 'http-422' ? 'refused' : 'failed';

// POST /origins/shop_stock {shop}: the account's shelf (count now, the next unit's price with the zone tax, when the next unit returns), read only, no counter needed.
export function stockOf(r: unknown): Stock | null {
  const v = r as { shop?: unknown; revision?: unknown; now?: unknown; rows?: unknown } | null;
  if (!v || typeof v.shop !== 'string' || !Number.isSafeInteger(v.revision) || typeof v.now !== 'number' || !Array.isArray(v.rows)) return null;
  const rows: Stock['rows'] = [];
  for (const x of v.rows as Record<string, unknown>[]) {
    if (!x || typeof x.item !== 'string' || !Number.isSafeInteger(x.count) || !Number.isSafeInteger(x.max) || !Number.isSafeInteger(x.price) || !(x.nextRestockAt === null || typeof x.nextRestockAt === 'number')) return null;
    rows.push({ item: x.item, count: x.count as number, max: x.max as number, price: x.price as number, nextRestockAt: x.nextRestockAt as number | null });
  }
  return { shop: v.shop, revision: v.revision as number, now: v.now, rows };
}
export const readStock = (token: string | null, shop: string, opts: Opts = {}): Promise<Stock | Offline> => call('shop_stock', { shop }, token, stockOf, opts);
