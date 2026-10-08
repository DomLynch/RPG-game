// The gear screen's rules (origins/preview/gear.ts): every doll slot listed in order, and Wear as a swap that is all-or-nothing and keeps one of each.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOLL, wearSwap, wornRows } from './gear.ts';
import { body, empty, hood, helm, lookup, refused, server, value } from '../inventory/testkit.ts';
import { equip, find, openInventory, receive, type Inventory } from '../inventory/inventory.ts';
import type { ItemInstance } from '../contracts/items.ts';

const withItems = (inv: Inventory, ...items: ItemInstance[]): Inventory => items.reduce((a, item) => value(receive(a, item, lookup)), inv);
const where = (inv: Inventory, id: string): string => { const l = find(inv, id)!.location; return l.kind === 'equipped' ? `equipped:${l.slot}` : l.kind; };

test('wornRows lists every paperdoll slot in the doll\'s order, the piece on it or null', () => {
  const inv = value(equip(withItems(empty(), helm()), 'inst:helm-0001', lookup, server(11)));
  const rows = wornRows(inv);
  assert.deepEqual(rows.map((r) => r.slot), DOLL);
  assert.equal(rows.find((r) => r.slot === 'head')!.item?.id, 'inst:helm-0001');
  assert.equal(rows.filter((r) => r.item).length, 1);
});

test('Wear swaps the piece in a held slot: the old one goes to the pack, the new one is worn, one of each holds', () => {
  const worn = value(equip(withItems(empty(), helm()), 'inst:helm-0001', lookup, server(11)));
  const inv = value(wearSwap(withItems(worn, hood()), 'inst:hood-0001', lookup, server(50)));
  assert.equal(where(inv, 'inst:hood-0001'), 'equipped:head');
  assert.equal(where(inv, 'inst:helm-0001'), 'pack');
  assert.equal(inv.items.length, 2);
});

test('Wear into an empty slot is plain equip; a piece the wearer\'s rank cannot wear is refused and nothing moves', () => {
  const plain = value(wearSwap(withItems(empty(), helm()), 'inst:helm-0001', lookup, server(11)));
  assert.equal(where(plain, 'inst:helm-0001'), 'equipped:head');
  const before = withItems(value(equip(withItems(empty(), helm()), 'inst:helm-0001', lookup, server(11))), hood());
  refused(wearSwap(before, 'inst:hood-0001', lookup, server(11)), 'rule-violation', 'tier');
  assert.equal(where(before, 'inst:helm-0001'), 'equipped:head');
});

test('a swap with a full pack is refused in plain words and the worn piece stays on', () => {
  const small = value(openInventory({ owner: empty().owner, account: empty().account, items: [], packSize: 2, bankSize: 2 }, lookup));
  const worn = value(equip(withItems(small, helm()), 'inst:helm-0001', lookup, server(11)));
  const full = withItems(worn, hood(), body());   // the hood and the cuirass fill both pack slots
  const r = wearSwap(full, 'inst:hood-0001', lookup, server(50));
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.issues[0]!.message : '', /pack is full/);
  assert.equal(where(full, 'inst:helm-0001'), 'equipped:head');
  assert.equal(where(full, 'inst:hood-0001'), 'pack');
});
