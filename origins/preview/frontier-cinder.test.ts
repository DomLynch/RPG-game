// The Cinder pass (frontier-cinder.ts, ?look=cinder): deterministic, never on a road or landmark, the camp kit still fits, and its cost is pinned (draw calls unchanged, triangles under a cap).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geometryOf } from './exchange.ts';
import type { Piece } from './exchange-plan.ts';
import { demoCamps, CAMP_KIT } from './frontier-camp.ts';
import { cinderDress, withCinder } from './frontier-cinder.ts';
import { frontierDress } from './frontier-dress.ts';
import { frontierBuild, frontierPlan, inZone, onRoad, roadFrame } from './frontier-plan.ts';

const F = frontierPlan(), B = frontierBuild(F), BASE = frontierDress(F, B), C = cinderDress(F, B, BASE), ALL = withCinder(F, B, BASE);
const zones = F.zones.filter((z) => z.region.includes('frontier'));
const tris = (ps: readonly Piece[]) => ps.reduce((n, p) => { const g = geometryOf(p.shape); return n + (g.index ? g.index.count : g.attributes.position!.count) / 3; }, 0);
const drawCalls = (d: { ground: readonly Piece[]; pieces: readonly Piece[] }) => new Set(d.ground.map((p) => p.layer)).size + new Set(d.pieces.map((p) => p.layer)).size;   // meshPieces merges one mesh per layer, per call

test('the Cinder pass is deterministic and adds ground, pieces and a few solids', () => {
  assert.deepEqual(cinderDress(F, B, BASE), C);
  assert.ok(C.ground.length > 500 && C.pieces.length > 500 && C.solids.length > 10, `${C.ground.length} ground, ${C.pieces.length} pieces, ${C.solids.length} solids`);
});

test('its solids stand in a zone, off the west road, clear of every landmark, the first view and the base solids', () => {
  const marks = [...zones.flatMap((z) => Object.values(z.landmarks)), F.giver.at], r = F.road;
  for (const s of C.solids) {
    assert.ok(zones.some((z) => inZone(z, s.x, s.z)) && !onRoad(F, s.x, s.z));
    for (const m of marks) assert.ok(Math.hypot(m.x - s.x, m.z - s.z) > s.r + 4, 'a Cinder solid near a landmark');
    for (const o of [...B.solids, ...BASE.solids]) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) >= o.r + s.r, 'a Cinder solid inside a base solid');
    const { along, across } = roadFrame(F, s.x, s.z);
    assert.ok(!(along > -10 && along < 60 && across < r.width / 2 + s.r + 10), 'a Cinder solid in the first view');
  }
});

test('the walker can still stand on every landmark and along the west road with the Cinder pass in', () => {
  const all = [...B.solids, ...ALL.solids], free = (x: number, z: number) => !all.some((s) => Math.hypot(x - s.x, z - s.z) < s.r);
  for (const z of zones) for (const a of Object.values(z.landmarks)) if (!B.solids.some((s) => Math.hypot(a.x - s.x, a.z - s.z) < s.r)) assert.ok(free(a.x, a.z));
  for (let t = 0; t <= 1; t += 0.05) assert.ok(free(F.road.from.x + (F.road.to.x - F.road.from.x) * t, F.road.from.z + (F.road.to.z - F.road.from.z) * t));
});

test('no Cinder solid stands inside a camp kit placed on the Frontier (the camps keep off the dressing, so a camp never loses its ring)', () => {
  const camps = demoCamps(F, B, ALL.pieces);
  assert.ok(camps.length > 0);
  for (const c of camps) for (const s of C.solids) assert.ok(Math.hypot(c.at.x - s.x, c.at.z - s.z) > CAMP_KIT.radius, `Cinder solid at ${s.x.toFixed(1)},${s.z.toFixed(1)} inside a camp of radius ${CAMP_KIT.radius}`);
});

test('budget: the Cinder pass adds no draw call (all on the stone layer the base already merges) and its triangles stay under a pinned cap', () => {
  assert.equal(drawCalls(ALL), drawCalls(BASE), 'a new layer means a new draw call');
  const before = tris(BASE.ground) + tris(BASE.pieces), after = tris(ALL.ground) + tris(ALL.pieces);
  console.log(`cinder budget: draw calls ${drawCalls(BASE)} -> ${drawCalls(ALL)}, triangles ${before} -> ${after}`);
  assert.ok(after - before < 0.4 * before, `${before} -> ${after} triangles`);
});
