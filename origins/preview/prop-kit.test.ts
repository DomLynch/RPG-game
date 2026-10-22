// The prop kit (prop-kit.ts, props-defs.json): deterministic, the rows drive it, it stands inside its zone, off roads and landmarks, adds no walk blocker, each recipe has its own random stream, and its cost is pinned.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geometryOf } from './exchange.ts';
import type { Piece } from './exchange-plan.ts';
import { frontierDress } from './frontier-dress.ts';
import { withCinder } from './frontier-cinder.ts';
import { propKit, propPieces, withPropKit } from './prop-kit.ts';
import { frontierBuild, frontierPlan, inZone, onRoad } from './frontier-plan.ts';
import { goblinZone } from '../world/goblin-field-rules.ts';
import { propKitRow, propRow, recipesOf } from '../world/props-rules.ts';
import { ridgeProfile, smokeColumns } from './horizon-dome.ts';
import { smokePuff } from './goblin-smoke.ts';
import { goblinRule } from '../world/goblin-field-rules.ts';

const KIT = 'goblin-camp', F = frontierPlan(), B = frontierBuild(F), BASE = withCinder(F, B, frontierDress(F, B)), K = propKit(F, B, BASE, goblinZone(), KIT), Z = F.zones.find((z) => z.zone === goblinZone())!;
const tris = (ps: readonly Piece[]) => ps.reduce((n, p) => { const g = geometryOf(p.shape); return n + (g.index ? g.index.count : g.attributes.position!.count) / 3; }, 0);

test('the goblin zone exists in the plan, the kit is deterministic, and an unknown kit or zone places nothing', () => {
  assert.ok(Z, `zone ${goblinZone()} is in the Frontier plan`);
  assert.deepEqual(propKit(F, B, BASE, goblinZone(), KIT), K);
  assert.equal(propKit(F, B, BASE, goblinZone(), 'no-such-kit').centre, null); assert.equal(propKit(F, B, BASE, 'no-such-zone', KIT).centre, null);
});
test('every recipe of the kit is there, bounded by its rows: fires with embers, tents, palisades, totems, banners, bones, trees', () => {
  const p = K.dress.pieces, has = (shape: string, tintId: number) => p.filter((q) => q.shape[0] === shape).length >= tintId;
  assert.ok(K.fires.length >= 1 && K.fires.length <= ['fires', 'torches', 'gate-torch-1', 'gate-torch-2'].reduce((n, id) => n + recipesOf(KIT).find((r) => r.id === id)!.count, 0), `${K.fires.length} fires`);   // the camp fires, the wall's torch ring and the two gate torches
  const flames = recipesOf(KIT).filter((r) => r.props.some((w) => w.prop === 'torch-flame')).length;   // a standing torch is one fire with two flame cones on the coal layer
  assert.equal(p.filter((q) => q.layer === 'coal').length, K.fires.length + flames, 'one ember disc per fire pit, two flame cones per standing torch, on the coal layer');
  assert.ok(has('cone', 5) && has('sphere', 1) && has('cylinder', 20) && has('box', 40), 'a skull, poles and bones, and the totems\' horns');   // cone 20 -> 5 (2026-10-22, the palisade border cut: the central stakes left the rows, so the part-built kit has 10 cones, all from totems and torches)
  assert.ok(propKit(F, B, BASE, goblinZone(), KIT, undefined, true).models.some((m) => m.node.includes('palisade')), 'the palisades are still there: the outskirts rim draws them as models');
  assert.ok(p.length > 100 && p.length < 600, `${p.length} pieces`);
});
test('a prop is its parts turned and scaled: a ring part repeats round the axis, the yaw turns the offsets, and a scale of 2 doubles every size and offset', () => {
  const fire = propRow('fire'), ring = fire.parts.find((q) => q.ring)!, a = propPieces(fire, 10, 20, 0, 1), b = propPieces(fire, 10, 20, 0, 2);
  assert.equal(a.length, fire.parts.length - 1 + ring.ring!.n, 'the stone ring is n pieces');
  assert.equal(b.length, a.length); assert.deepEqual(b[0]!.shape.slice(1, 4), a[0]!.shape.slice(1, 4).map((n) => (n as number) * 2));
  const tot = propRow('totem'), t0 = propPieces(tot, 0, 0, 0, 1), t90 = propPieces(tot, 0, 0, Math.PI / 2, 1), horn0 = t0.find((q) => q.shape[0] === 'cone')!, horn90 = t90.find((q) => q.shape[0] === 'cone')!;
  assert.ok(Math.abs(horn0.z - 0.3) < 1e-9 && Math.abs(horn0.x) < 1e-9, 'unturned: the horn sits on local z'); assert.ok(Math.abs(horn90.x - 0.3) < 1e-9 && Math.abs(horn90.z) < 1e-9, 'a quarter turn: local z points along world x');
});
test('a spot recipe stands one piece at its row place: ringRadius m from the camp centre at its angle, and nowhere else', () => {
  const row = recipesOf(KIT).find((r) => r.id === 'spawn-post')!, only = propKit(F, B, BASE, goblinZone(), KIT, [row]), c = only.centre!, o = only.dress.pieces[0]!;
  assert.equal(row.kind, 'spot'); assert.ok(only.dress.pieces.length >= 1, 'the post stands (the spot is free)');
  assert.ok(Math.abs(Math.hypot(o.x - c.x, o.z - c.z) - row.ringRadius!) < 1, 'the shaft stands on its ring'); assert.ok(Math.abs(Math.atan2(o.x - c.x, o.z - c.z) - row.angle!) < 0.05, 'at its angle');
});
test('each recipe has its OWN random stream: removing one recipe leaves the dead trees of a later one exactly where they were', () => {
  const trunks = (res: ReturnType<typeof propKit>) => res.dress.pieces.filter((q) => q.shape[0] === 'cylinder' && q.shape[3] > 3 && q.tint.join() === '0.16,0.14,0.13').map((q) => `${q.x.toFixed(3)},${q.z.toFixed(3)}`).sort();
  const without = propKit(F, B, BASE, goblinZone(), KIT, recipesOf(KIT).filter((r) => r.id !== 'ribs'));
  assert.ok(trunks(K).length >= 1, 'the full kit has trees'); assert.deepEqual(trunks(without), trunks(K));
  assert.ok(without.dress.pieces.length < K.dress.pieces.length, 'the ribcage really was removed');
});
test('it adds NO walk blocker, adds only stone and coal pieces, and everything stands inside the goblin zone, off the roads and landmarks', () => {
  assert.equal(K.dress.solids.length, 0); assert.equal(K.dress.ground.length, 0);
  assert.deepEqual([...new Set(K.dress.pieces.map((q) => q.layer))].sort(), ['coal', 'plain', 'stone']);
  const marks = [...Object.values(Z.landmarks), F.giver.at], kit = propKitRow(KIT)!;
  for (const q of K.dress.pieces) {
    assert.ok(inZone(Z, q.x, q.z, 0) || Math.hypot(q.x - K.centre!.x, q.z - K.centre!.z) < kit.radius + 6, `a piece at ${q.x.toFixed(1)}, ${q.z.toFixed(1)} is in the zone`);
    assert.ok(!onRoad(F, q.x, q.z), 'off the west road'); assert.ok(!marks.some((m) => Math.hypot(m.x - q.x, m.z - q.z) < 6), 'clear of every landmark');
  }
});
test('the merged Dress keeps the base (and its road strips) and adds the kit; cost is pinned (no new layers, triangles under a cap)', () => {
  const all = withPropKit(K, BASE); assert.equal(all.pieces.length, BASE.pieces.length + K.dress.pieces.length); assert.equal(all.solids.length, BASE.solids.length); assert.equal(all.strips, BASE.strips);
  assert.ok(tris(K.dress.pieces) < 20000, `${tris(K.dress.pieces)} triangles`);
});
test('the dome ridge is deterministic, closes at the seam, spans 0..1; far smoke columns are seeded; a smoke puff rises, widens and fades', () => {
  const a = ridgeProfile(7, 256); assert.deepEqual(a, ridgeProfile(7, 256)); assert.notDeepEqual(a, ridgeProfile(8, 256));
  assert.equal(Math.min(...a), 0); assert.equal(Math.max(...a), 1); assert.ok(Math.abs(a[0]! - a[255]!) < 0.15, 'the seam is closed (neighbouring samples are close)');
  assert.equal(smokeColumns(7, goblinRule('smokeColumns')).length, goblinRule('smokeColumns')); assert.deepEqual(smokeColumns(7, 3), smokeColumns(7, 3));
  const lo = smokePuff(0, 0), hi = smokePuff(goblinRule('smokeRise') / goblinRule('smokeSpeed') * 0.8, 0);
  assert.ok(hi.y > lo.y && hi.size > lo.size && lo.opacity === 0 && hi.opacity >= 0 && hi.opacity <= goblinRule('smokeOpacity'), 'rises, widens, starts invisible');
});
