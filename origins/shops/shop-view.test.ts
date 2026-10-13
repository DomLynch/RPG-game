import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REGION1_SHOPS, EXCHANGE_PROVISIONER } from '../region1/shops.ts';
import { shopView, shelfLine, span, chromeText } from './shop-view.ts';

const list = REGION1_SHOPS.get(EXCHANGE_PROVISIONER)!;
test('the shop view lists every row at the list price the writer charges, with the list revision', () => {
  const v = shopView(EXCHANGE_PROVISIONER, list, (i) => `N:${i}`)!;
  assert.equal(v.revision, list.revision);
  assert.deepEqual(v.lines.map((l) => [l.item, l.price]), list.rows.map((r) => [r.item, r.price]));   // shop.ts checkBuy: cost = row.price x quantity
  assert.equal(v.lines[0]!.name, 'N:item:grave-iron');
});
test('the shelf text is the row\'s static max and restock; the level gate shows only where the row has one', () => {
  const [iron, helm] = list.rows.map((r) => shelfLine(r, (i) => i));
  assert.equal(iron!.shelfText, 'Up to 20 on the shelf, one back every 2 min'); assert.equal(iron!.levelText, '');
  assert.equal(helm!.shelfText, 'Up to 1 on the shelf, one back every 30 min'); assert.equal(helm!.levelText, 'From level 11');
});
test('spans read in the largest whole unit', () => { assert.equal(span(45), '45 s'); assert.equal(span(120), '2 min'); assert.equal(span(7200), '2 h'); assert.equal(span(90), '90 s'); });
test('an unknown shop has no view', () => { assert.equal(shopView('service:none', undefined, (i) => i), null); });
test('chrome text fills its values', () => { assert.equal(chromeText('bought', { item: 'Grave iron', cost: 6 }), 'Bought Grave iron for 6 bronze.'); });
