// What the shop screen shows, as data (top-30 item 4, Web): one line per row of the shop's list. Pure: no DOM, clock or storage; the names come from the injected namer, the words from shop-text.json.
// `shelfLine` is the ONE place a price and a stock figure come from. Today they are the list's own numbers (shop.ts checkBuy charges row.price x quantity, and the shelf is per account with no read route),
// so it shows the list price and the static max / restock; when Backend wires buyPrice / restockedStock into checkBuy and adds a stock read, only this function changes.
import TEXT from './shop-text.json' with { type: 'json' };
import type { ShopList, ShopRow } from './shop.ts';

export type ShelfLine = { item: string; name: string; price: number; priceText: string; shelfText: string; levelText: string };
const { chrome: CHROME } = TEXT;
const fill = (template: string, values: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
export const chromeText = (key: keyof typeof CHROME, values: Record<string, string | number> = {}): string => fill(CHROME[key], values);

export function span(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return chromeText('hours', { n: seconds / 3600 });
  if (seconds >= 60 && seconds % 60 === 0) return chromeText('minutes', { n: seconds / 60 });
  return chromeText('seconds', { n: seconds });
}
export function shelfLine(row: ShopRow, name: (item: string) => string): ShelfLine {
  return { item: row.item, name: name(row.item), price: row.price, priceText: chromeText('price', { price: row.price }),
    shelfText: chromeText('shelf', { max: row.max, restock: span(row.restockSeconds) }), levelText: row.minLevel ? chromeText('level', { level: row.minLevel }) : '' };
}
export type ShopView = { shop: string; revision: number; lines: ShelfLine[] };
export const shopView = (shop: string, list: ShopList | undefined, name: (item: string) => string): ShopView | null =>
  list ? { shop, revision: list.revision, lines: list.rows.map((r) => shelfLine(r, name)) } : null;
