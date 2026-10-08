import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBuy, stockNow, validateShopList, type BuyState, type ShopList } from './shop.ts';

const list: ShopList = { id: 'shoplist:frontier-provisioner', revision: 3, currency: 'bronze', rows: [
  { item: 'item:bandage', price: 4, max: 5, restockSeconds: 60 },
  { item: 'item:iron-helm', price: 120, max: 1, restockSeconds: 600, minLevel: 12 },
] };
const known = (id: string) => id.startsWith('item:');
const T = 1_000_000;
const st = (over: Partial<BuyState> = {}): BuyState => ({ level: 12, bronze: 500, open: true, stock: null, now: T, ...over });

test('a good list validates; each bad field is named', () => {
  assert.deepEqual(validateShopList(list, known), []);
  const bad: ShopList = { id: 'shop one', revision: 0, currency: 'coin' as 'bronze', rows: [
    { item: 'thing:x', price: 0, max: 0, restockSeconds: 5, minLevel: 0 },
    { item: 'item:bandage', price: 1, max: 1, restockSeconds: 60 }, { item: 'item:bandage', price: 1, max: 1, restockSeconds: 60 },
  ] };
  assert.deepEqual(validateShopList(bad, known).map((i) => i.path),
    ['id', 'revision', 'currency', 'rows[0].item', 'rows[0].price', 'rows[0].max', 'rows[0].restockSeconds', 'rows[0].minLevel', 'rows[2].item']);
  assert.deepEqual(validateShopList({ ...list, rows: [] }, known).map((i) => i.path), ['rows']);
});

test('restock: one unit per restockSeconds, capped at max, partial step kept (2004Scape)', () => {
  const row = list.rows[0];
  assert.deepEqual(stockNow(row, null, T), { count: 5, at: T }, 'no row = full shelf');
  assert.deepEqual(stockNow(row, { count: 1, at: T }, T + 59_000), { count: 1, at: T });
  assert.deepEqual(stockNow(row, { count: 1, at: T }, T + 150_000), { count: 3, at: T + 120_000 }, 'two whole steps, 30 s carried');
  assert.deepEqual(stockNow(row, { count: 1, at: T }, T + 3_600_000), { count: 5, at: T + 3_600_000 }, 'never above max');
  assert.deepEqual(stockNow(row, { count: 9, at: T }, T + 10), { count: 5, at: T + 10 }, 'a list that shrank max clamps');
  assert.deepEqual(stockNow(row, { count: 1, at: T }, T - 5_000), { count: 1, at: T }, 'a clock step back gains nothing');
});

test('checkBuy prices from the list and refuses in order: closed, stale list, item, quantity, level, stock, funds', () => {
  const buy = (item: string, quantity: number, s = st(), revision = 3) => checkBuy(list, { item, quantity, revision }, s);
  assert.deepEqual(buy('item:bandage', 2), { ok: true, cost: 8, stockAfter: { count: 3, at: T } });
  assert.deepEqual(buy('item:bandage', 1, st({ open: false })), { ok: false, reason: 'closed' });
  assert.deepEqual(buy('item:bandage', 1, st(), 2), { ok: false, reason: 'stale-list' });
  assert.deepEqual(buy('item:gold-bar', 1), { ok: false, reason: 'unknown-item' });
  for (const q of [0, -1, 1.5, 101]) assert.deepEqual(buy('item:bandage', q), { ok: false, reason: 'bad-quantity' }, `quantity ${q}`);
  assert.deepEqual(buy('item:iron-helm', 1, st({ level: 11 })), { ok: false, reason: 'level' });
  assert.deepEqual(buy('item:bandage', 6), { ok: false, reason: 'stock' });
  assert.deepEqual(buy('item:bandage', 1, st({ stock: { count: 0, at: T - 30_000 } })), { ok: false, reason: 'stock' }, 'sold out until the step');
  assert.deepEqual(buy('item:iron-helm', 1, st({ bronze: 119 })), { ok: false, reason: 'funds' });
  assert.deepEqual(buy('item:iron-helm', 1, st({ bronze: 120 })), { ok: true, cost: 120, stockAfter: { count: 0, at: T } });
});

test('a buy from a partly stocked shelf keeps the restock clock running', () => {
  const s = st({ stock: { count: 1, at: T - 90_000 } });   // 1 + one step = 2 now, 30 s into the next step
  assert.deepEqual(checkBuy(list, { item: 'item:bandage', quantity: 2, revision: 3 }, s), { ok: true, cost: 8, stockAfter: { count: 0, at: T - 30_000 } });
});
