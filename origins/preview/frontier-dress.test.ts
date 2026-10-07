// The Ash Frontier's dressing (frontier-dress.ts): deterministic, inside its zones, and never in the way of the layout (landmarks, the west road, the roads it lays itself).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frontierDress } from './frontier-dress.ts';
import { frontierBuild, frontierPlan, inZone, onRoad } from './frontier-plan.ts';

const F = frontierPlan(), B = frontierBuild(F), D = frontierDress(F, B);
const zones = F.zones.filter((z) => z.region.includes('frontier'));

test('the dressing is deterministic: the same plan twice gives the same ground, pieces and solids', () => {
  assert.deepEqual(frontierDress(F, B), D);
});

test('it is a real amount of dressing, not a handful, and stays inside the phone budget', () => {
  assert.ok(D.ground.length > 300 && D.pieces.length > 300, `${D.ground.length} ground, ${D.pieces.length} pieces`);
  assert.ok(D.ground.length + D.pieces.length < 6000, `${D.ground.length + D.pieces.length} placed pieces`);
  assert.ok(D.solids.length > 60 && D.solids.length < 1500, `${D.solids.length} solids`);
});

test('every zone gets its own dirt slab, and every solid stands on a zone, off the west road, clear of every landmark and the Bounty giver', () => {
  assert.equal(D.ground.filter((p) => p.shape[0] === 'box' && p.shape[2] === 0.04).length, zones.length);
  const marks = [...zones.flatMap((z) => Object.values(z.landmarks)), F.giver.at];
  for (const s of D.solids) {
    assert.ok(zones.some((z) => inZone(z, s.x, s.z)), `solid at ${s.x.toFixed(1)},${s.z.toFixed(1)} is off every zone`);
    assert.ok(!onRoad(F, s.x, s.z), 'a solid on the west road');
    for (const m of marks) assert.ok(Math.hypot(m.x - s.x, m.z - s.z) > s.r + 4, `solid of radius ${s.r} within 4 m of a landmark`);
  }
});

test('the walker can still stand on every landmark and along the west road with the dressing in', () => {
  const all = [...B.solids, ...D.solids], free = (x: number, z: number) => !all.some((s) => Math.hypot(x - s.x, z - s.z) < s.r);
  for (const z of zones) for (const [name, a] of Object.entries(z.landmarks)) if (!B.solids.some((s) => Math.hypot(a.x - s.x, a.z - s.z) < s.r)) assert.ok(free(a.x, a.z), `${z.zone}/${name} is blocked by the dressing`);
  const r = F.road;
  for (let t = 0; t <= 1; t += 0.05) assert.ok(free(r.from.x + (r.to.x - r.from.x) * t, r.from.z + (r.to.z - r.from.z) * t), 'the west road is blocked');
});

test("the walker's first view is clear: no solid within the road's width + 6 m of its line, or within 14 m of where it ends", () => {
  const r = F.road, ux = Math.sin(r.facing), uz = Math.cos(r.facing);
  for (const s of D.solids) {
    const along = (s.x - r.from.x) * ux + (s.z - r.from.z) * uz, across = Math.abs(-(s.x - r.from.x) * uz + (s.z - r.from.z) * ux);
    assert.ok(!(along > -10 && along < 60 && across < r.width / 2 + s.r + 6), `solid at ${s.x.toFixed(1)},${s.z.toFixed(1)} sits in the first view`);
    assert.ok(Math.hypot(r.to.x - s.x, r.to.z - s.z) >= s.r + 14, 'solid within 14 m of the road end');
  }
});
