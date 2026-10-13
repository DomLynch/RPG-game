import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boughtOf, buyOne, newOp, readStock, refusalKey, stockOf } from './shop-net.ts';

test('the buy body names ids and a quantity only, never a price, cost or stock', async () => {
  let sent: Record<string, unknown> = {};
  const fetch = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ ok: true, result: { shop: 's', item: 'item:grave-iron', quantity: 1, cost: 6, revision: 1, received: ['inst:a'], replayed: false } }), { status: 200 }); }) as typeof globalThis.fetch;
  const r = await buyOne('tok', 'char:1', 's', 'item:grave-iron', 1, 'shop:iron-00000001', { fetch });
  assert.deepEqual(Object.keys(sent).sort(), ['character', 'item', 'op', 'quantity', 'revision', 'shop']);
  assert.equal('cost' in r && r.cost, 6);
});
test('replies and refusals', () => {
  assert.equal(boughtOf({ shop: 's' }), null);
  assert.deepEqual([refusalKey('no-session'), refusalKey('http-409'), refusalKey('http-422'), refusalKey('timeout')], ['offline', 'stale', 'refused', 'failed']);
  assert.match(newOp('item:grave-iron', 1_700_000_000_000, () => 0.5), /^shop:[a-z0-9][a-z0-9:._-]{7,119}$/);
});
test('shop_stock: the body names the shop only, and the reply is read strictly', async () => {
  let url = '', sent: Record<string, unknown> = {};
  const reply = { shop: 's', revision: 1, now: 100, rows: [{ item: 'item:grave-iron', count: 20, max: 20, price: 5, nextRestockAt: null }, { item: 'item:x', count: 0, max: 1, price: 60, nextRestockAt: 160 }] };
  const fetch = (async (u: string, init: RequestInit) => { url = u; sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ ok: true, result: reply }), { status: 200 }); }) as typeof globalThis.fetch;
  const r = await readStock('tok', 's', { fetch, base: '/origins' });
  assert.equal(url, '/origins/shop_stock'); assert.deepEqual(sent, { shop: 's' });
  assert.deepEqual('rows' in r && r.rows.map((x) => [x.item, x.price, x.nextRestockAt]), [['item:grave-iron', 5, null], ['item:x', 60, 160]]);
  assert.deepEqual(await readStock(null, 's', { fetch }), { offline: 'no-session' });
  assert.equal(stockOf({ ...reply, rows: [{ item: 'item:x', count: 'many', max: 1, price: 1, nextRestockAt: null }] }), null);
  assert.equal(stockOf({ ...reply, rows: [{ item: 'item:x', count: 1, max: 1, price: 1.5, nextRestockAt: null }] }), null);
  assert.equal(stockOf({ shop: 's' }), null);
});
