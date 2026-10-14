// shop_stock (read only): the shelf, the next unit's stock-elastic price and the next restock time, from a stand-in database.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db } from './db.ts';
import { shopStockHandler } from './shop-buy.ts';
import type { ShopList } from '../shops/shop.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW = 10_000_000, SHOP = 'service:t';
const list: ShopList = { id: 'shoplist:t', revision: 1, currency: 'bronze', zone: 'zone2', rows: [
  { item: 'item:ore', price: 100, max: 40, restockSeconds: 300, class: 'material' }, { item: 'item:plain', price: 7, max: 3, restockSeconds: 60 }] };
const dbWith = (shelves: Record<string, { count: number; at: number } | null>): Db => ({
  async run(sql, vars = {}) { if (sql.includes('origins_shop_stock')) return JSON.stringify({ now: NOW, stock: shelves[vars.i!] ?? null }); return 'present'; },
});
const call = (db: Db, body: Record<string, unknown>) => shopStockHandler(new Map([[SHOP, list]]))({ db, account: A } as never, body);

test('shop_stock: a full shelf prices at the floor with the zone tax and has no restock time', async () => {
  const r = await call(dbWith({}), { shop: SHOP }) as { rows: { item: string; count: number; price: number; nextRestockAt: number | null }[] };
  assert.deepEqual(r.rows.map((x) => [x.item, x.count, x.price, x.nextRestockAt]), [['item:ore', 40, 84, null], ['item:plain', 3, 7, null]]);   // 100 x 80 % x 105 %
});

test('shop_stock: a drained shelf costs more, restocks lazily, and names when the next unit returns', async () => {
  const at = NOW - 450_000;   // 450 s ago: one 300 s step has passed, 150 s of the next is kept
  const r = await call(dbWith({ 'item:ore': { count: 10, at }, 'item:plain': { count: 0, at: NOW - 10_000 } }), { shop: SHOP }) as { rows: { count: number; price: number; nextRestockAt: number }[] };
  assert.equal(r.rows[0]!.count, 11);
  assert.equal(r.rows[0]!.price, Math.ceil(100 * (80 + 80 * (1 - 11 / 40)) * 105 / 10_000));
  assert.equal(r.rows[0]!.nextRestockAt, at + 2 * 300_000);
  assert.deepEqual([r.rows[1]!.count, r.rows[1]!.nextRestockAt], [0, NOW - 10_000 + 60_000]);
});

test('shop_stock: an unknown shop is a 400', async () => {
  await assert.rejects(call(dbWith({}), { shop: 'service:nope' }), /not a shop/);
});
