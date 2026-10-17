// A signed-out player's pack (guest-pack.ts): the session's held items drawn as the bank's Backpack GearView, in memory only (Dom 2026-10-16: "nothing written, gone on reload").
import test from 'node:test';
import assert from 'node:assert/strict';
import { guestViewOf, type ItemInfo } from '../origins/preview/guest-pack.ts';
import { guestBag } from '../origins/preview/guest-loot.ts';

const INFO: Record<string, ItemInfo> = {
  'item:starter.rusty-sword': { name: 'Rusty sword', category: 'gear' },
  'item:wolf.pelt': { name: 'Wolf pelt', category: 'material' },
};
const info = (id: string) => INFO[id];

test('a held weapon is one pack piece, a held material one stock row with its quantity, filled from cell 0', () => {
  const v = guestViewOf([{ item: 'item:starter.rusty-sword', quantity: 1 }, { item: 'item:wolf.pelt', quantity: 3 }], info, 16);
  assert.deepEqual(v.pieces.map((p) => [p.id, p.item, p.where, p.index, p.lootId]), [['guest:0', 'item:starter.rusty-sword', 'pack', 0, null]]);
  assert.deepEqual(v.stock.map((r) => [r.id, r.name, r.quantity, r.index]), [['guest:1', 'Wolf pelt', 3, 1]]);
  assert.equal(v.packSize, 16); assert.equal(v.bankSize, 0); assert.deepEqual(v.worn, {});
});

test('a piece carries the lootId its item row names (Backend\'s bridge), never one the page made up', () => {
  const v = guestViewOf([{ item: 'item:x', quantity: 1 }], () => ({ name: 'X', category: 'gear', lootId: 'goblin.Helmet' }), 4);
  assert.equal(v.pieces[0]!.lootId, 'goblin.Helmet');
});

test('an unknown item is shown by its id as a stock row, and the grid stops at packSize', () => {
  const v = guestViewOf([{ item: 'item:unknown', quantity: 2 }, { item: 'item:starter.rusty-sword', quantity: 5 }], info, 3);
  assert.equal(v.stock[0]!.name, 'item:unknown');
  assert.equal(v.pieces.length + v.stock.length, 3, 'one stock row and two pieces fill the three cells; the rest are dropped from the view');
});

test('the bag lives in memory: a fresh bag (a reload) is empty, and the view is a pure read of it', () => {
  const bag = guestBag(); bag.add({ loot: [{ item: 'item:starter.rusty-sword', quantity: 1 }], bronze: 0 });
  assert.equal(guestViewOf(bag.items(), info, 16).pieces.length, 1);
  assert.deepEqual(guestBag().items(), [], 'the reload case in a real page is the row ground-prompt-check guest run');
});
