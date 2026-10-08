// The Frontier's kit placements (frontier-kit.ts): deterministic, only the kit's node names, inside a zone, and never on the west road, a landmark or the dressing's solids.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frontierDress } from './frontier-dress.ts';
import { frontierKit, KIT_NODES } from './frontier-kit.ts';
import { frontierBuild, frontierPlan, inZone, onRoad } from './frontier-plan.ts';

const F = frontierPlan(), B = frontierBuild(F), D = frontierDress(F, B), K = frontierKit(F, B, D);
const zones = F.zones.filter((z) => z.region.includes('frontier'));

test('the kit placement is deterministic and a real amount, every node is one the kit ships', () => {
  assert.deepEqual(frontierKit(F, B, D), K);
  assert.ok(K.placements.length > 100 && K.placements.length < 4000, `${K.placements.length} placements`);
  for (const p of K.placements) assert.ok((KIT_NODES as readonly string[]).includes(p.node), p.node);
  for (const n of KIT_NODES) assert.ok(K.placements.some((p) => p.node === n), `${n} is never placed`);
});

test('every placement stands in a zone, off the west road, clear of landmarks and the dressing solids', () => {
  const marks = [...zones.flatMap((z) => Object.values(z.landmarks)), F.giver.at];
  for (const p of K.placements) {
    assert.ok(zones.some((z) => inZone(z, p.x, p.z)), `${p.node} at ${p.x.toFixed(1)},${p.z.toFixed(1)} is off every zone`);
    assert.ok(!onRoad(F, p.x, p.z), `${p.node} on the west road`);
    for (const m of marks) assert.ok(Math.hypot(m.x - p.x, m.z - p.z) > 6, `${p.node} within 6 m of a landmark`);
    for (const s of [...B.solids, ...D.solids]) assert.ok(Math.hypot(s.x - p.x, s.z - p.z) > s.r, `${p.node} inside a solid`);
  }
});
