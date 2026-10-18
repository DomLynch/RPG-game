// The Frontier's kit placements (frontier-kit.ts): deterministic, only the kit's node names, inside a zone, and never on the west road, a landmark or the dressing's solids.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frontierDress } from './frontier-dress.ts';
import { frontierKit } from './frontier-kit.ts';
import { loadZone } from '../zones/loader.ts';
const { nodes: KIT_NODES, landmarks: LANDMARK_NODES } = loadZone().kit;
import { frontierBuild, frontierPlan, inFirstView, inZone, onRoad } from './frontier-plan.ts';

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

test('the four landmarks stand along the west road, outside the first view, off the road and the buildings', () => {
  assert.deepEqual(K.landmarks.map((l) => l.node), [...LANDMARK_NODES]);
  for (const l of K.landmarks) {
    assert.ok(!onRoad(F, l.x, l.z), `${l.node} on the road`);
    assert.ok(!inFirstView(F, l.x, l.z, 3.5), `${l.node} in the walker's first view`);
    for (const s of [...B.solids, ...D.solids]) assert.ok(Math.hypot(s.x - l.x, s.z - l.z) > s.r + 3.5, `${l.node} touches a solid`);
  }
});

test('Zone 5 (the Bone Hollow): its kit is the dungeon kit, every piece a `fixed` row stood at its plan landmark, and the end room keeps clear of the cache', () => {
  const z5 = loadZone('5'), F5 = frontierPlan(true, '5'), B5 = frontierBuild(F5), K5 = frontierKit(F5, B5, frontierDress(F5, B5), undefined, '5');
  const fixed = z5.kit.fixed ?? [], hollow = F5.zones.find((z) => z.zone === 'bone-hollow')!, cache = hollow.landmarks['hollow-cache']!, den = hollow.landmarks['hollow-den']!;
  assert.equal(z5.kit.url, '/world/kit/dungeon-kit.glb');
  assert.equal(K5.placements.length, fixed.length, 'no scattered kinds: the fixed rows are the whole kit');
  fixed.forEach((p, i) => {
    const a = hollow.landmarks[p.at]!, q = K5.placements[i]!;
    assert.deepEqual([q.node, q.x, q.z], [p.node, a.x + p.dx, a.z + p.dz]);
    assert.ok(inZone(hollow, q.x, q.z), `${p.node} stands outside the hollow`);
    assert.ok(Math.hypot(q.x - cache.x, q.z - cache.z) > 1.5 + 0.8 * q.scale, `${p.node} crowds the cache`);   // the fixed ground piece
    if (p.node === 'bone_pile') assert.ok(Math.hypot(q.x - den.x, q.z - den.z) < 12, 'bone piles ring the den');
  });
  assert.equal(fixed.filter((p) => p.node === 'cave_doorway').length, 2, 'a doorway at each end');
  assert.equal(K5.solids.length, fixed.filter((p) => p.solid > 0).length);
});
