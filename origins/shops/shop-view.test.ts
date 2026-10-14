import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REGION1_SHOPS, EXCHANGE_PROVISIONER } from '../region1/shops.ts';
import { shopView, span, restockText, chromeText, type Stock } from './shop-view.ts';

const list = REGION1_SHOPS.get(EXCHANGE_PROVISIONER)!;
const NOW = 5_000_000;
// What the writer's shop_stock answers (origins/server/shop-buy.ts): grave iron on a full shelf is the floor price (5, not the list's 6), the gear shelf has one drained.
const stock: Stock = { shop: EXCHANGE_PROVISIONER, revision: list.revision, now: NOW, rows: [
  { item: 'item:grave-iron', count: 20, max: 20, price: 5, nextRestockAt: null },
  { item: 'item:frontier.ash-helm', count: 0, max: 1, price: 72, nextRestockAt: NOW + 95_000 },
  { item: 'item:frontier.watch-greaves', count: 1, max: 1, price: 60, nextRestockAt: null }] };

test('the price shown is the writer\'s next-unit price from shop_stock, never the list price', () => {
  const v = shopView(list, stock, (i) => `N:${i}`)!;
  assert.deepEqual(v.lines.map((l) => [l.item, l.price]), stock.rows.map((r) => [r.item, r.price]));
  assert.equal(list.rows[0]!.price, 6); assert.equal(v.lines[0]!.price, 5); assert.equal(v.lines[0]!.priceText, '5 bronze');
  assert.equal(v.revision, stock.revision); assert.equal(v.lines[0]!.name, 'N:item:grave-iron');
});
test('stock text, sold out, the restock time on the writer\'s clock, and the level gate', () => {
  const [iron, helm, greaves] = shopView(list, stock, (i) => i)!.lines;
  assert.equal(iron!.stockText, '20 of 20 on the shelf'); assert.equal(iron!.restockInMs, null); assert.equal(iron!.levelText, ''); assert.equal(iron!.soldOut, false);
  assert.equal(helm!.stockText, 'Sold out'); assert.equal(helm!.soldOut, true); assert.equal(helm!.restockInMs, 95_000); assert.equal(helm!.levelText, 'From level 11');
  assert.equal(greaves!.soldOut, false);
});
test('a restock time already past reads as zero, never negative', () => {
  const v = shopView(list, { ...stock, now: NOW + 200_000 }, (i) => i)!;
  assert.equal(v.lines[1]!.restockInMs, 0);
});
test('a row the read does not carry is left off; an unknown shop has no view', () => {
  assert.equal(shopView(list, { ...stock, rows: stock.rows.slice(0, 1) }, (i) => i)!.lines.length, 1);
  assert.equal(shopView(undefined, stock, (i) => i), null);
});
test('spans read in hours, minutes and seconds', () => {
  assert.equal(span(45), '45 s'); assert.equal(span(120), '2 min'); assert.equal(span(95), '1 min 35 s'); assert.equal(span(7200), '2 h'); assert.equal(span(5400), '1 h 30 min'); assert.equal(span(-3), '0 s');
  assert.equal(restockText(null), ''); assert.equal(restockText(95_000), 'Next one back in 1 min 35 s');
});
test('chrome text fills its values', () => { assert.equal(chromeText('bought', { item: 'Grave iron', cost: 5 }), 'Bought Grave iron for 5 bronze.'); });
