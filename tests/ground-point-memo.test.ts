// groundPointOf builds its zone's plan once (Web 2026-10-21): the pickup poll asked frontierPlan for the whole Frontier once per ground row every 3 s, an 80 ms task on a phone. Pure.
import assert from 'node:assert/strict';
import test from 'node:test';
import { groundPlanOf, groundPointOf } from '../origins/world/ground-point.ts';
import { frontierPlan } from '../origins/preview/frontier-plan.ts';
import { toWorld } from '../origins/world/derive.ts';
import { GROUND_ITEMS } from '../origins/world/ground-items.ts';

const rows = Object.values(GROUND_ITEMS);

test('the plan is built once per zone: every call, and every row, gets the same plan object', () => {
  const first = groundPlanOf('1');
  for (const row of rows) groundPointOf(row);
  assert.equal(groundPlanOf('1'), first, 'a call to groundPointOf rebuilt the plan');
  assert.notEqual(frontierPlan(true, '1'), first, 'a fresh build is a new object, so the identity above is the proof that nothing rebuilt it');
});

test('two calls return the same point, and it is the point a fresh plan gives', () => {
  assert.ok(rows.length > 0);
  for (const row of rows) {
    const again = groundPointOf(row);
    assert.deepEqual(groundPointOf(row), again, `${row.zone}/${row.place}: two calls differ`);
    const plan = frontierPlan(true, /^zone(\d+)$/.exec(row.zone)![1]!).zones.find((z) => z.zone === row.place);
    if (!plan) { assert.equal(again, null); continue; }
    const c = toWorld({ x: 0, d: plan.depth / 2 }, plan.mount);
    assert.deepEqual(again, { x: c.x + (row.offsetX ?? 0), z: c.z + (row.offsetZ ?? 0) }, `${row.zone}/${row.place}: the memoised point differs from a fresh build's`);
  }
});

test('a row naming a place or zone this build does not have is null, and does not throw', () => {
  assert.equal(groundPointOf({ zone: 'zone1', place: 'no-such-place' }), null);
  assert.equal(groundPointOf({ zone: 'hub', place: 'x' }), null);
});
