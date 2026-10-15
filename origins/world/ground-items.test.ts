// Ground items as rows: the shipped rows load, "starter only" is the ref to starterItem (a non-starter item is refused), and the loader refuses a bad row. Pure.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUND_ITEMS, STARTER_ITEMS, loadGroundItems } from './ground-items.ts';
import { zonePlaces } from '../zones/loader.ts';

const id = 'ground:zone1.rusty-sword-1', row = GROUND_ITEMS[id]!;
const raw = (patch: object = {}, starters: object = STARTER_ITEMS) => ({ starterItems: starters, groundItems: { [id]: { ...row, ...patch } } });

test('the shipped row: a rusty sword, one, per account, an hour to respawn, at a place that exists in its zone', () => {
  assert.deepEqual(Object.keys(GROUND_ITEMS), [id]);
  assert.deepEqual([row.item, row.qty, row.scope, row.respawnSec], ['item:starter.rusty-sword', 1, 'account', 3600]);
  assert.ok(row.zone === 'zone1' && zonePlaces().flatMap((pl) => Object.keys(pl.zones)).includes(row.place), 'the place is one of the zones\' places (through the loader)');
  assert.deepEqual(Object.keys(loadGroundItems(raw()).items), [id]);
});

test('starter only is data: an item that is not a starterItem row is refused by the registry ref, and so is an id that is not ground:...', () => {
  assert.throws(() => loadGroundItems(raw({ item: 'item:loot.veteran.Trident' })), /unknown-ref|starterItem/);
  assert.throws(() => loadGroundItems({ starterItems: STARTER_ITEMS, groundItems: { 'rusty-sword': row } }), /ground:<zone>/);
});

test('the loader refuses: a scope other than account, qty 0 or above the starter maxQty, respawn outside 60..86400, a radius outside 0.25..5, a lone offset, a missing field', () => {
  for (const [patch, why] of [[{ scope: 'shared' }, /scope/], [{ qty: 0 }, /qty/], [{ qty: 2 }, /qty/], [{ respawnSec: 59 }, /respawnSec/], [{ respawnSec: 86_401 }, /respawnSec/],
    [{ radiusM: 0.1 }, /radiusM/], [{ radiusM: 6 }, /radiusM/], [{ offsetX: 1 }, /offset/], [{ place: undefined }, /missing-field|place/]] as const) {
    assert.throws(() => loadGroundItems(raw(patch)), why, JSON.stringify(patch));
  }
  assert.throws(() => loadGroundItems(raw({}, { 'item:starter.rusty-sword': { maxQty: 0 } })), /maxQty/);
  assert.deepEqual(Object.keys(loadGroundItems(raw({ radiusM: 2, offsetX: 1.5, offsetZ: -2 })).items), [id], 'an optional radius and an offset pair are accepted');
});
