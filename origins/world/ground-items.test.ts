// Ground items as rows: the shipped rows load, "starter only" is the ref to starterItem (a non-starter item is refused), and the loader refuses a bad row. Pure.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUND_ITEMS, GROUND_LIMITS, STARTER_ITEMS, loadGroundItems } from './ground-items.ts';
import { zonePlaces } from '../zones/loader.ts';
import { frontierPlan } from '../preview/frontier-plan.ts';
import { groundPointOf } from '../server/ground-take.ts';
import { toWorld } from './derive.ts';
import { ITEMS } from '../region1/content.ts';
import { ARMOUR_SLOTS } from '../../src/core/loot.ts';

const id = 'ground:zone1.rusty-sword-1', row = GROUND_ITEMS[id]!;
const raw = (patch: object = {}, starters: object = STARTER_ITEMS, limits: object = GROUND_LIMITS) => ({ starterItems: starters, groundLimits: { ground: limits }, groundItems: { [id]: { ...row, ...patch } } });

test('the shipped rows: a rusty sword (cinder-fields), a knife, gladius, cleaver and estoc, and the goblin scrap cap (cinder-fields) and shin plates (cinder-hold), one each, per account, hidden while taken, at places that exist in their zone', () => {
  assert.deepEqual(Object.keys(GROUND_ITEMS), [id, 'ground:zone1.knife-1', 'ground:zone1.gladius-1', 'ground:zone1.cleaver-1', 'ground:zone1.estoc-1', 'ground:zone1.goblin-scrap-cap-1', 'ground:zone1.goblin-shin-plates-1']);
  assert.deepEqual([row.item, row.qty, row.scope, row.respawnSec], ['item:starter.rusty-sword', 1, 'account', 3600]);
  assert.deepEqual(Object.values(GROUND_ITEMS).map((g) => g.item.replace('item:starter.', '')), ['rusty-sword', 'knife', 'gladius', 'cleaver', 'estoc', 'goblin-scrap-cap', 'goblin-shin-plates']);
  assert.deepEqual(Object.values(GROUND_ITEMS).map((g) => g.place), ['cinder-fields', 'ferry-landing', 'blood-ruin', 'cinder-hold', 'mere-end', 'cinder-fields', 'cinder-hold'], 'one weapon per place, in the same order, then the two armour finds on the goblin ground and the hold (placements per Strategy 2026-10-16)');
  for (const g of Object.values(GROUND_ITEMS)) assert.ok(g.zone === 'zone1' && zonePlaces().flatMap((pl) => Object.keys(pl.zones)).includes(g.place) && g.qty === 1 && g.scope === 'account' && g.hiddenWhileTaken === true, g.item);
  assert.deepEqual(Object.keys(loadGroundItems({ starterItems: STARTER_ITEMS, groundLimits: { ground: GROUND_LIMITS }, groundItems: GROUND_ITEMS }).items), Object.keys(GROUND_ITEMS), 'the loader accepts the seven rows');
});

test('each item sits inside its own place\'s bounds and in no other place (the HUD names the first place that contains the walker), no two places share a weapon, and east-road and black-mere hold nothing (Strategy 2026-10-15)', () => {
  const plan = frontierPlan(true, '1');
  const inside = (z: (typeof plan.zones)[number], p: { x: number; z: number }) => {
    const quad = [[-z.width / 2, 0], [z.width / 2, 0], [z.width / 2, z.depth], [-z.width / 2, z.depth]].map(([x, d]) => toWorld({ x: x!, d: d! }, z.mount));
    const side = quad.map((a, i) => { const b = quad[(i + 1) % 4]!; return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x); });
    return side.every((v) => v >= 0) || side.every((v) => v <= 0);
  };
  for (const [gid, g] of Object.entries(GROUND_ITEMS)) {
    const p = groundPointOf(g)!, containing = plan.zones.filter((z) => inside(z, p)).map((z) => z.zone);
    assert.ok(containing.includes(g.place), `${gid} is inside ${g.place}`);
    assert.deepEqual(containing, [g.place], `${gid} is in no other place (the Black Mere / Mere's End overlap is why the estoc stands past z -180)`);
  }
  const items = Object.values(GROUND_ITEMS).map((g) => g.item), places = Object.values(GROUND_ITEMS).map((g) => g.place);
  assert.equal(new Set(items).size, items.length, 'no item is placed twice');
  // A weapon or an armour piece by its item definition's slot (the loot slots), not by its name. Strategy 2026-10-16: a place may hold one weapon and one armour find, never two of a kind.
  const armour = (item: string) => (ARMOUR_SLOTS as readonly (string | null)[]).includes(ITEMS.find((d) => d.id === item)?.slot ?? null);
  for (const [kind, want] of [['weapons', false], ['armour finds', true]] as const) {
    const here = Object.values(GROUND_ITEMS).filter((g) => armour(g.item) === want).map((g) => g.place);
    assert.ok(here.length > 0 && new Set(here).size === here.length, `no two ${kind} share a place (${here.join(', ')})`);
  }
  assert.ok(!places.includes('east-road') && !places.includes('black-mere'));
});

test('every row reads the one default respawn (groundLimits.defaultRespawnSec = 3600) unless it names its own; a default outside min..max is refused', () => {
  assert.equal(GROUND_LIMITS.defaultRespawnSec, 3600);
  assert.ok(Object.values(GROUND_ITEMS).every((g) => g.respawnSec === GROUND_LIMITS.defaultRespawnSec), 'all seven share one number');
  assert.equal(loadGroundItems(raw({ respawnSec: undefined })).items[id]!.respawnSec, 3600, 'a row with no respawnSec gets the default');
  assert.equal(loadGroundItems(raw({ respawnSec: 120 })).items[id]!.respawnSec, 120, 'a row may still name its own');
  for (const bad of [GROUND_LIMITS.minRespawnSec - 1, GROUND_LIMITS.maxRespawnSec + 1]) assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, defaultRespawnSec: bad })), /defaultRespawnSec/);
});

test('starter only is data: an item that is not a starterItem row is refused by the registry ref, and so is an id that is not ground:...', () => {
  assert.throws(() => loadGroundItems(raw({ item: 'item:loot.veteran.Trident' })), /unknown-ref|starterItem/);
  assert.throws(() => loadGroundItems({ starterItems: STARTER_ITEMS, groundLimits: { ground: GROUND_LIMITS }, groundItems: { 'rusty-sword': row } }), /ground:<zone>/);
});

test('the loader refuses: a scope other than account, qty 0 or above the starter maxQty, respawn outside 60..86400, a radius outside 0.25..5, a lone offset, a missing field', () => {
  for (const [patch, why] of [[{ scope: 'shared' }, /scope/], [{ qty: 0 }, /qty/], [{ qty: 2 }, /qty/], [{ respawnSec: GROUND_LIMITS.minRespawnSec - 1 }, /respawnSec/], [{ respawnSec: GROUND_LIMITS.maxRespawnSec + 1 }, /respawnSec/],
    [{ radiusM: GROUND_LIMITS.minRadiusM / 2 }, /radiusM/], [{ radiusM: GROUND_LIMITS.maxRadiusM + 1 }, /radiusM/], [{ offsetX: 1, offsetZ: undefined }, /offset/], [{ place: undefined }, /missing-field|place/], [{ hiddenWhileTaken: undefined }, /missing-field|hiddenWhileTaken/]] as const) {
    assert.throws(() => loadGroundItems(raw(patch)), why, JSON.stringify(patch));
  }
  assert.throws(() => loadGroundItems(raw({}, { 'item:starter.rusty-sword': { maxQty: 0 } })), /maxQty/);
  assert.deepEqual(Object.keys(loadGroundItems(raw({ radiusM: 2, offsetX: 1.5, offsetZ: -2 })).items), [id], 'an optional radius and an offset pair are accepted');
});

test('the bounds are a ROW (groundLimit), not literals in the loader: tightening the row refuses the shipped respawn, and a broken row is refused', () => {
  assert.deepEqual(GROUND_LIMITS, { minRespawnSec: 60, maxRespawnSec: 86_400, defaultRespawnSec: 3600, minRadiusM: 0.25, maxRadiusM: 5, defaultRadiusM: 1.5 });
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, defaultRadiusM: 9 })), /limits/);
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, maxRespawnSec: 3599 })), /respawnSec/i);
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, maxRespawnSec: 59 })), /limits/);
  assert.throws(() => loadGroundItems(raw({}, STARTER_ITEMS, { ...GROUND_LIMITS, minRadiusM: 0 })), /limits/);
});
