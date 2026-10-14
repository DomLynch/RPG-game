// What the shop screen shows, as data (top-30 item 4, Web): one line per row of the shop's list, with what the SERVER says about it. Pure: no DOM, clock or storage; names come from the injected namer, words from shop-text.json.
// `shelfLine` is the ONE place a price and a stock figure come from: the price is the writer's own next-unit price (stock curve x zone tax, shop_stock), the count is the account's shelf now, and the restock time is
// the writer's clock. The list row only adds what the read does not carry (the level gate). Nothing here computes a price: the screen shows what shop_buy will charge and the writer re-checks it on the buy.
import TEXT from './shop-text.json' with { type: 'json' };
import type { ShopList, ShopRow } from './shop.ts';

/** One row of the shop_stock reply (origins/server/shop-buy.ts shopStockHandler). `nextRestockAt` and `now` are the writer's database clock in ms; null on a full shelf. */
export type StockRow = { item: string; count: number; max: number; price: number; nextRestockAt: number | null };
export type Stock = { shop: string; revision: number; now: number; rows: StockRow[] };
export type ShelfLine = { item: string; name: string; price: number; priceText: string; stockText: string; restockInMs: number | null; levelText: string; soldOut: boolean };
const { chrome: CHROME } = TEXT;
const fill = (template: string, values: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
export const chromeText = (key: keyof typeof CHROME, values: Record<string, string | number> = {}): string => fill(CHROME[key], values);

export function span(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 3600) return [chromeText('hours', { n: Math.floor(s / 3600) }), s % 3600 >= 60 ? chromeText('minutes', { n: Math.floor((s % 3600) / 60) }) : ''].filter(Boolean).join(' ');
  if (s >= 60) return [chromeText('minutes', { n: Math.floor(s / 60) }), s % 60 ? chromeText('seconds', { n: s % 60 }) : ''].filter(Boolean).join(' ');
  return chromeText('seconds', { n: s });
}
export const restockText = (ms: number | null): string => (ms === null ? '' : chromeText('restockIn', { time: span(ms / 1000) }));
export function shelfLine(row: ShopRow, shelf: StockRow, now: number, name: (item: string) => string): ShelfLine {
  const restockInMs = shelf.nextRestockAt === null ? null : Math.max(0, shelf.nextRestockAt - now);
  return { item: row.item, name: name(row.item), price: shelf.price, priceText: chromeText('price', { price: shelf.price }),
    stockText: shelf.count > 0 ? chromeText('stock', { count: shelf.count, max: shelf.max }) : chromeText('soldOut'), restockInMs,
    levelText: row.minLevel ? chromeText('level', { level: row.minLevel }) : '', soldOut: shelf.count <= 0 };
}
export type ShopView = { shop: string; revision: number; lines: ShelfLine[] };
// A row the read does not carry is left off (the shop and the list agree on rows; a mismatch is the list changing under the page, which the revision catches on the buy).
export function shopView(list: ShopList | undefined, stock: Stock, name: (item: string) => string): ShopView | null {
  if (!list) return null;
  const lines = list.rows.flatMap((row) => { const s = stock.rows.find((r) => r.item === row.item); return s ? [shelfLine(row, s, stock.now, name)] : []; });
  return { shop: stock.shop, revision: stock.revision, lines };
}
