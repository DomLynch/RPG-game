// Composable shop lists (Town plan A2, Dom 2026-10-08 10:3x): one list per shop, one row per item (price, stock cap, restock, level gate), and the pure
// re-check the server runs on EVERY buy. The client may show prices and stock; the server prices from the list itself, never from the request.
// Pure: no DOM, no clock, no storage. The caller passes `now` (database clock), the stock row it read, the buyer's level and bronze, and whether the shop is
// open (World's schedule: shops shut about 22:00-06:00). Persisting stock, the one-transaction settle and the one-time token are the writer's next step.
//
// Restock is 2004Scape's (MIT, Copyright (c) 2023-2025 Lost City; src/engine/World.ts, the inventory restock loop): a stocked item below its normal count
// gains ONE every `stockrate` ticks. Here that is one per `restockSeconds` of elapsed time, computed lazily from the last write, so no tick has to run.

export const SHOP_LIST_VERSION = 1;
export const PRICE_MAX = 1_000_000;          // bronze
export const STOCK_MAX = 1_000;
export const RESTOCK_RANGE: readonly [number, number] = [10, 86_400];   // s
export const BUY_MAX = 100;                  // per request
import { buyPrice, restockedStock, vendorClass, zoneTax } from './vendor-economy.ts';

// `class` (vendor-economy.json: gear, material, cosmetic) switches a row to the stock-elastic price; `zone` (zone1..zone4) names the list's buy tax (default zone1).
export type ShopRow = { item: string; price: number; max: number; restockSeconds: number; minLevel?: number; class?: string };
export type ShopList = { id: string; revision: number; currency: 'bronze'; zone?: string; rangeCm?: number; rows: readonly ShopRow[] };   // rangeCm: how near its counter a buyer must stand (presence centimetres); the server refuses a shop without one as away
export type ShopIssue = { path: string; message: string };

// Rejects a bad list before it ships. `item` says whether an item id is a registered item definition.
export function validateShopList(list: ShopList, item: (id: string) => boolean): ShopIssue[] {
  const out: ShopIssue[] = [], int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!/^shoplist:[a-z0-9-]+$/.test(list.id)) out.push({ path: 'id', message: 'a shop list id is shoplist:<kebab>' });
  if (!int(list.revision, 1, 1_000_000)) out.push({ path: 'revision', message: 'revision is a whole number from 1' });
  if (list.currency !== 'bronze') out.push({ path: 'currency', message: 'shops sell for bronze' });
  if (!list.rows.length) out.push({ path: 'rows', message: 'a shop sells at least one item' });
  const seen = new Set<string>();
  list.rows.forEach((r, i) => {
    const p = `rows[${i}]`;
    if (!item(r.item)) out.push({ path: `${p}.item`, message: `${r.item} is not a registered item` });
    if (seen.has(r.item)) out.push({ path: `${p}.item`, message: `${r.item} is listed twice` });
    seen.add(r.item);
    if (!int(r.price, 1, PRICE_MAX)) out.push({ path: `${p}.price`, message: `price is 1..${PRICE_MAX} bronze` });
    if (!int(r.max, 1, STOCK_MAX)) out.push({ path: `${p}.max`, message: `max stock is 1..${STOCK_MAX}` });
    if (!int(r.restockSeconds, RESTOCK_RANGE[0], RESTOCK_RANGE[1])) out.push({ path: `${p}.restockSeconds`, message: `restock is ${RESTOCK_RANGE[0]}..${RESTOCK_RANGE[1]} s` });
    if (r.minLevel !== undefined && !int(r.minLevel, 1, 100)) out.push({ path: `${p}.minLevel`, message: 'the level gate is 1..100' });
    if (r.class !== undefined && !vendorClass(r.class)) out.push({ path: `${p}.class`, message: `${r.class} is not a vendor class` });
  });
  if (list.zone !== undefined && !zoneTax(list.zone)) out.push({ path: 'zone', message: `${list.zone} is not a tax zone` });
  return out;
}

// The stock row as last written (count after the last buy or restock, and when). Absent = a full shelf.
export type Stock = { count: number; at: number };   // at: ms, database clock

// The shelf now: one unit back per restockSeconds since `at`, never above max. `at` advances by whole restock steps only, so a partial step is kept.
export function stockNow(row: ShopRow, last: Stock | null, now: number): Stock {
  if (!last || last.count >= row.max) return { count: last ? Math.min(last.count, row.max) : row.max, at: now };
  const step = row.restockSeconds * 1000, gained = Math.max(0, Math.floor((now - last.at) / step));
  const c = row.class ? vendorClass(row.class) : null;
  const count = c ? restockedStock({ ...c, restockSeconds: row.restockSeconds }, last.count, (now - last.at) / 1000, row.max) : Math.min(row.max, last.count + gained);
  return { count, at: count >= row.max ? now : last.at + gained * step };
}

// What `quantity` units cost from a shelf of `count`: a classed row sums the per-unit stock-elastic price as the shelf empties, with the list's zone tax; an unclassed row is price x quantity.
export function costOf(list: ShopList, row: ShopRow, count: number, quantity: number): number {
  const c = row.class ? vendorClass(row.class) : null, tax = zoneTax(list.zone ?? 'zone1');
  if (!c || !tax) return row.price * quantity;
  let total = 0;
  for (let i = 0; i < quantity; i++) total += buyPrice(c, row.price, count - i, tax, row.max);
  return total;
}

export type BuyRequest = { item: string; quantity: number; revision: number };   // revision = the list the client was shown
export type BuyState = { level: number; bronze: number; open: boolean; stock: Stock | null; now: number };
export type BuyRefusal = 'closed' | 'stale-list' | 'unknown-item' | 'bad-quantity' | 'level' | 'stock' | 'funds';
export type BuyCheck = { ok: true; cost: number; stockAfter: Stock } | { ok: false; reason: BuyRefusal };

// The server's re-check on every buy. Order: shop open, the client saw this list's revision (else 409: re-read the list), the item is on it, the
// quantity, the level gate, stock now, then funds. Prices come from the list; the request's only numbers are the item's quantity and the revision.
export function checkBuy(list: ShopList, req: BuyRequest, s: BuyState): BuyCheck {
  if (!s.open) return { ok: false, reason: 'closed' };
  if (req.revision !== list.revision) return { ok: false, reason: 'stale-list' };
  const row = list.rows.find((r) => r.item === req.item);
  if (!row) return { ok: false, reason: 'unknown-item' };
  if (!Number.isInteger(req.quantity) || req.quantity < 1 || req.quantity > BUY_MAX) return { ok: false, reason: 'bad-quantity' };
  if (s.level < (row.minLevel ?? 1)) return { ok: false, reason: 'level' };
  const shelf = stockNow(row, s.stock, s.now);
  if (shelf.count < req.quantity) return { ok: false, reason: 'stock' };
  const cost = costOf(list, row, shelf.count, req.quantity);
  if (s.bronze < cost) return { ok: false, reason: 'funds' };
  // A full shelf starts its restock clock at the first sale; a partly stocked one keeps its partial step.
  return { ok: true, cost, stockAfter: { count: shelf.count - req.quantity, at: shelf.count >= row.max ? s.now : shelf.at } };
}
