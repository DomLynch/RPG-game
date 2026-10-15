// Ground items as rows: the shipped rows load, "starter only" is the ref to starterItem (a non-starter item is refused), and the loader refuses a bad row. Pure.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUND_ITEMS, GROUND_LIMITS, STARTER_ITEMS, loadGroundItems } from './ground-items.ts';
import { zonePlaces } from '../zones/loader.ts';

const id = 'ground:zone1.rusty-sword-1', row = GROUND_ITEMS[id]!;
const raw = (patch: object = {}, starters: object = STARTER_ITEMS, limits: object = GROUND_LIMITS) => ({ starterItems: starters, groundLimits: { ground: limits }, groundItems: { [id]: { ...row, ...patch } } });

test('the shipped row: a rusty sword, one, per account, an hour to respawn, at a place that exists in its zone', () => {
  assert.deepEqual(Object.keys(GROUND_ITEMS), [id]);
  assert.deepEqual([row.item, row.qty, row.scope, row.respawnSec], ['item:starter.rusty-sword', 1, 'account', 3600]);
  assert.ok(row.zone === 'zone1' && zonePlaces().flatMap((pl) => Object.keys(pl.zones)).includes(row.place), 'the place is one of the zones\' places (through the loader)');
  assert.deepEqual(Object.keys(loadGroundItems(raw()).items), [id]);
});

test('starter only is data: an item that is not a starterItem row is refused by the registry ref, and so is an id that is not ground:...', () => {
  assert.throws(() => loadGroundItems(raw({ item: 'item:loot.veteran.Trident' })), /unknown-ref|starterItem/);
  assert.throws(() => loadGroundItems({ starterItems: STARTER_ITEMS, groundLimits: { ground: GROUND_LIMITS }, groundItems: { 'rusty-sword': row } }), /ground:<zone>/);
});

test('the loader refuses: a scope other than account, qty 0 or above the starter maxQty, respawn outside 60..86400, a radius outside 0.25..5, a lone offset, a missing field', () => {
  for (const [patch, why] of [[{ scope: 'shared' }, /scope/], [{ qty: 0 }, /qty/], [{ qty: 2 }, /qty/], [{ respawnSec: GROUND_LIMITS.minRespawnSec - 1 }, /respawnSec/], [{ respawnSec: GROUND_LIMITS.maxRespawnSec + 1 }, /respawnSec/],
    [{ radiusM: GROUND_LIMITS.minRadiusM / 2 }, /radiusM/], [{ radiusM: GROUND_LIMITS.maxRadiusM + 1 }, /radiusM/], [{ offsetX: 1 }, /offset/], [{ place: undefined }, /missing-field|place/], [{ hiddenWhileTaken: undefined }, /missing-field|hiddenWhileTaken/]] as const) {
    assert.throws(() => loadGroundItems(raw(patch)), why, JSON.stringify(patch));
  }
  assert.throws(() => loadGroundItems(raw({}, { 'item:starter.rusty-sword': { maxQty: 0 } })), /maxQty/);
  assert.deepEqual(Object.keys(loadGroundItems(raw({ radiusM: 2, offsetX: 1.5, offsetZ: -2 })).items), [id], 'an optional radius and an offset pair are accepted');
});

test('the bounds are a ROW (groundLimit), not literals in the loader: tightening the row refuses the shipped respawn, and a broken row is refused', () => {
  assert.deepEqual(GROUND_LIMITS, { minRespawnSec: 60, maxRespawnSec: 86_400, minRadiusM: 0.25, maxRadiusM: 5, defaultRadiusM: 1.5 });
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, defaultRadiusM: 9 })), /limits/);
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, maxRespawnSec: 3599 })), /respawnSec/);
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, maxRespawnSec: 59 })), /limits/);
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, minRadiusM: 0 })), /limits/);
});
