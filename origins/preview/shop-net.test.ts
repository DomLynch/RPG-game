import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boughtOf, buyOne, newOp, refusalKey } from './shop-net.ts';

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
