// The goblin field's kit (goblin-field.ts, ?look=goblin): deterministic, rows drive it, it stands inside its zone, off roads and landmarks, adds no walk blocker, and its cost is pinned.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geometryOf } from './exchange.ts';
import type { Piece } from './exchange-plan.ts';
import { frontierDress } from './frontier-dress.ts';
import { withCinder } from './frontier-cinder.ts';
import { goblinFieldKit, withGoblinField } from './goblin-field.ts';
import { frontierBuild, frontierPlan, inZone, onRoad } from './frontier-plan.ts';
import { goblinRule, goblinTint, goblinZone } from '../world/goblin-field-rules.ts';
import { ridgeProfile, smokeColumns } from './horizon-dome.ts';
import { smokePuff } from './goblin-smoke.ts';

const F = frontierPlan(), B = frontierBuild(F), BASE = withCinder(F, B, frontierDress(F, B)), K = goblinFieldKit(F, B, BASE), Z = F.zones.find((z) => z.zone === goblinZone())!;
const tris = (ps: readonly Piece[]) => ps.reduce((n, p) => { const g = geometryOf(p.shape); return n + (g.index ? g.index.count : g.attributes.position!.count) / 3; }, 0);

test('the goblin zone exists in the plan, and the kit is deterministic', () => {
  assert.ok(Z, `zone ${goblinZone()} is in the Frontier plan`);
  assert.deepEqual(goblinFieldKit(F, B, BASE), K);
});
test('every kind of the kit is there, driven by the rows: stakes, totems, fires with embers, dead trees, bones', () => {
  const p = K.dress.pieces, tint = (t: number[], q: Piece) => q.tint.every((v, i) => v === t[i]);
  const stakes = p.filter((q) => q.shape[0] === 'cone' && q.shape[1] === goblinRule('stakeR'));
  assert.ok(stakes.length >= goblinRule('palisadeStakes') && stakes.length <= goblinRule('palisadeSegments') * goblinRule('palisadeStakes'), `${stakes.length} stakes`);
  assert.ok(stakes.every((q) => q.shape[2] >= goblinRule('stakeHMin') && q.shape[2] <= goblinRule('stakeHMax')), 'stake heights are within their rows');
  const totemPoles = p.filter((q) => q.shape[0] === 'cylinder' && q.shape[1] === 0.13); assert.ok(totemPoles.length >= 1 && totemPoles.length <= goblinRule('totemCount'), `${totemPoles.length} totems`);
  assert.ok(K.fires.length >= 1 && K.fires.length <= goblinRule('fireCount'), `${K.fires.length} fires`);
  assert.equal(p.filter((q) => q.layer === 'coal').length, K.fires.length, 'one ember disc per fire, on the coal layer');
  assert.ok(p.some((q) => tint(goblinTint('bone'), q) && q.shape[0] === 'sphere'), 'a skull');
  const trees = p.filter((q) => tint(goblinTint('dead'), q) && q.shape[0] === 'cylinder' && q.shape[1] === 0.09).length; assert.ok(trees >= 1 && trees <= goblinRule('treeClumps') * goblinRule('treesPerClump'), `${trees} dead trees`);
  assert.ok(p.filter((q) => tint(goblinTint('bone'), q) && q.shape[0] === 'box').length >= 10, 'bones');
});
test('it adds NO walk blocker, adds only stone and coal pieces, and everything stands inside the goblin zone, off the roads and landmarks', () => {
  assert.equal(K.dress.solids.length, 0); assert.equal(K.dress.ground.length, 0);
  assert.deepEqual([...new Set(K.dress.pieces.map((q) => q.layer))].sort(), ['coal', 'stone']);
  const marks = [...Object.values(Z.landmarks), F.giver.at];
  for (const q of K.dress.pieces) {
    assert.ok(inZone(Z, q.x, q.z, 0) || Math.hypot(q.x - K.centre!.x, q.z - K.centre!.z) < goblinRule('clusterRadius') + 4, `a piece at ${q.x.toFixed(1)}, ${q.z.toFixed(1)} is in the zone`);
    assert.ok(!onRoad(F, q.x, q.z), 'off the west road');
    assert.ok(!marks.some((m) => Math.hypot(m.x - q.x, m.z - q.z) < 6), 'clear of every landmark');
  }
});
test('the merged Dress keeps the base and adds the kit; cost is pinned (no new layers, triangles under a cap)', () => {
  const all = withGoblinField(K, BASE); assert.equal(all.pieces.length, BASE.pieces.length + K.dress.pieces.length); assert.equal(all.solids.length, BASE.solids.length);
  assert.ok(tris(K.dress.pieces) < 20000, `${tris(K.dress.pieces)} triangles`); assert.ok(K.dress.pieces.length > 100, `${K.dress.pieces.length} pieces`);
});
test('the dome ridge is deterministic, closes at the seam, spans 0..1; far smoke columns are seeded; a smoke puff rises, widens and fades', () => {
  const a = ridgeProfile(7, 256); assert.deepEqual(a, ridgeProfile(7, 256)); assert.notDeepEqual(a, ridgeProfile(8, 256));
  assert.equal(Math.min(...a), 0); assert.equal(Math.max(...a), 1); assert.ok(Math.abs(a[0]! - a[255]!) < 0.15, 'the seam is closed (neighbouring samples are close)');
  assert.equal(smokeColumns(7, goblinRule('smokeColumns')).length, goblinRule('smokeColumns')); assert.deepEqual(smokeColumns(7, 3), smokeColumns(7, 3));
  const lo = smokePuff(0, 0), hi = smokePuff(goblinRule('smokeRise') / goblinRule('smokeSpeed') * 0.8, 0);
  assert.ok(hi.y > lo.y && hi.size > lo.size && lo.opacity === 0 && hi.opacity >= 0 && hi.opacity <= goblinRule('smokeOpacity'), 'rises, widens, starts invisible');
});
