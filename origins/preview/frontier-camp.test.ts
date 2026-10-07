// The camp kit (frontier-camp.ts): deterministic, the right members, and placed only where the dressing's own rules allow.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMP_KIT, campKit, demoCamps, placeCamp } from './frontier-camp.ts';
import { frontierBuild, frontierPlan, frontierZoneAt, inFirstView, onRoad } from './frontier-plan.ts';

const F = frontierPlan(), B = frontierBuild(F);

test('a camp of 2 or 3 has a fire, a seat per member (the third stands), bedrolls, a crate and a glow; same seed twice is identical', () => {
  for (const n of [2, 3] as const) {
    const c = campKit({ x: 0, z: 0 }, n, 'k'), spots = c.spots;
    assert.equal(spots.length, n);
    assert.equal(spots.filter((s) => s.pose === 'stand').length, n === 3 ? 1 : 0);
    assert.ok(c.pieces.some((p) => p.layer === 'coal'), 'no coals in the fire');
    assert.ok(c.pieces.filter((p) => p.layer === 'iron').length === n, 'one bedroll per member');
    assert.ok(c.glow.radius === CAMP_KIT.glow.radius && c.glow.opacity > 0);
    assert.deepEqual(campKit({ x: 0, z: 0 }, n, 'k'), c);
    for (const s of spots.filter((q) => q.pose === 'sit')) assert.ok(Math.hypot(s.x, s.z) < CAMP_KIT.seat.ring + 0.1, 'a sitter off the fire');
  }
});

test('placeCamp only drops a camp inside a Frontier zone, off the west road, out of the first view and clear of the buildings; it can say no', () => {
  const camps = demoCamps(F, B);
  assert.ok(camps.length >= 2, `${camps.length} demo camps`);
  for (const c of camps) {
    assert.ok(frontierZoneAt(F, c.at.x, c.at.z), 'camp off every zone');
    assert.ok(!onRoad(F, c.at.x, c.at.z) && !inFirstView(F, c.at.x, c.at.z, CAMP_KIT.radius), 'camp on the road or in the first view');
    for (const s of B.solids) assert.ok(Math.hypot(s.x - c.at.x, s.z - c.at.z) >= s.r + CAMP_KIT.radius, 'camp inside a building');
  }
  assert.equal(placeCamp(F, B, { x: 9999, z: 9999 }, 2, 'nowhere'), null);
});
