// The per-zone presence fields are rows: the town's (town-zones.json) and each zone package's `presence` block, by world-zone name. Today's launch values hold: 1.0 everywhere, the Pit quiet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CENTRE_CM, PORTALS, REJOIN_EDGE, TRADE_ZONES, ZONE_ROWS, clearOfTradeAreas, inTradeArea, inside, landmarkCm, rejoinOf, zoneFields } from './zones.ts';
import { CM_PER_M } from './frame.ts';
import TOWN from './town-zones.json' with { type: 'json' };
import { presenceRule } from './presence-rules.ts';
import { toWorld } from '../world/derive.ts';
import { exchangePlace } from '../server/upgrade.ts';
import { BANK_PLACE } from '../../src/core/server.ts';
import type { WhereFn } from './where.ts';
import { allZoneIds, loadZone } from '../zones/loader.ts';
import { frontierPlan } from '../preview/frontier-plan.ts';

test('launch values: speed 1 everywhere and the Pit the only quiet zone', () => {
  for (const z of ZONE_ROWS) assert.deepEqual([z.id, z.speed, z.quiet], [z.id, 1, z.id === 'pit-yard']);
});

test('zoneFields: a package block sets its world zones, the town rows come first, and a name given twice is refused', () => {
  const f = zoneFields([{ id: 'pit-yard', quiet: true }], [{ presence: { 'cinder-fields': { speed: 1.2 }, 'east-road': { quiet: true } } }, {}]);
  assert.deepEqual(f.get('cinder-fields'), { speed: 1.2, quiet: undefined, trade: undefined, rejoin: undefined });
  assert.equal(f.get('east-road')?.quiet, true);
  assert.equal(f.get('pit-yard')?.quiet, true);
  assert.equal(f.get('nowhere'), undefined, 'a zone with no row keeps the defaults');
  assert.throws(() => zoneFields([{ id: 'pit-yard', quiet: true }], [{ presence: { 'pit-yard': { speed: 2 } } }]), /given twice/);
  assert.throws(() => zoneFields([], [{ presence: { a: {} } }, { presence: { a: {} } }]), /given twice/);
});

test('zoneFields: trade and rejoin pass through from a town row and from a package block', () => {
  const f = zoneFields([{ id: 'hall', trade: true, rejoin: 'door' }], [{ presence: { 'far-town': { trade: true, rejoin: 'gate' } } }]);
  assert.deepEqual([f.get('hall')?.trade, f.get('hall')?.rejoin, f.get('far-town')?.trade, f.get('far-town')?.rejoin], [true, 'door', true, 'gate']);
});

test('the trade areas are the rows flagged trade: the Exchange today, with its own rejoin edge outside every trade area', () => {
  assert.deepEqual([...TRADE_ZONES], ZONE_ROWS.filter((z) => z.trade).map((z) => z.id));
  assert.ok(TRADE_ZONES.has('exchange') && !TRADE_ZONES.has('pit-yard'));
  for (const id of TRADE_ZONES) {
    const edge = rejoinOf(id)!;
    assert.equal(inTradeArea(edge.x, edge.z), false, `${id}: the rejoin point is outside every trade area`);
  }
  assert.ok(TRADE_ZONES.has(TOWN.defaultRejoin), 'town-zones.json defaultRejoin names a trade zone');
  assert.deepEqual(rejoinOf(TOWN.defaultRejoin), REJOIN_EDGE, 'REJOIN_EDGE is the row-named default zone\'s edge, not the first row\'s');
  assert.equal(rejoinOf('pit-yard'), undefined);
  const bank = landmarkCm('exchange', 'bank');
  assert.deepEqual(clearOfTradeAreas(bank.x, bank.z), REJOIN_EDGE, 'a spot in the Exchange rejoins at its edge');
  assert.deepEqual(clearOfTradeAreas(CENTRE_CM, CENTRE_CM), { x: CENTRE_CM, z: CENTRE_CM }, 'a spot elsewhere is left alone');
});

// Presence refuses to start on a bad trade row (zones.ts, at import). This test runs the same checks over EVERY shipped row, listed or unlisted, so a bad row reds CI and never reaches a live presence restart.
test('every shipped trade row (town-zones.json and every zone package, unlisted too) names a rejoin landmark that exists, loads clean, and has a rejoin point outside every trade area', () => {
  assert.ok(rejoinOf('exchange'), 'the shipped town-zones.json trade row resolved its rejoin point at load');
  // Every trade box in world metres: the town's rows plus every package's trade zone, unlisted ones too (what presence only sees for listed zones).
  const boxes: { id: string; corners: { x: number; z: number }[] }[] = ZONE_ROWS.filter((r) => r.trade).map((r) => ({ id: r.id, corners: [...r.corners] }));
  const rejoins: { id: string; p: { x: number; z: number } }[] = [...TRADE_ZONES].map((id) => { const e = rejoinOf(id)!; return { id, p: { x: (e.x - CENTRE_CM) / CM_PER_M, z: (e.z - CENTRE_CM) / CM_PER_M } }; });
  for (const id of allZoneIds()) {
    const z = loadZone(id, true);   // throws on any zoneProblems: trade without rejoin, rejoin without trade, a presence key that is no world zone
    for (const [w, p] of Object.entries(z.presence ?? {})) {
      if (p.trade !== true) continue;
      const plan = frontierPlan(true, id).zones.find((q) => q.zone === w);
      assert.ok(plan, `${id}/${w}: a trade zone has a placed plan`);
      const at = plan.landmarks[p.rejoin!];
      assert.ok(at, `${id}/${w}: rejoin landmark "${p.rejoin}" exists`);
      const hw = plan.width / 2;
      boxes.push({ id: w, corners: ([[-hw, 0], [hw, 0], [hw, plan.depth], [-hw, plan.depth]] as const).map(([x, d]) => toWorld({ x, d }, plan.mount)) });
      rejoins.push({ id: w, p: { x: at.x, z: at.z + presenceRule('rejoinPastGateCm') / CM_PER_M } });
    }
  }
  for (const r of rejoins) for (const b of boxes) assert.equal(inside(b.corners, r.p), false, `trade zone ${r.id}: its rejoin point is outside the trade area of ${b.id}`);
});

test('inside: a convex quad, edges inclusive (the box test the rejoin check uses)', () => {
  const q = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
  assert.deepEqual([inside(q, { x: 5, z: 5 }), inside(q, { x: 10, z: 5 }), inside(q, { x: 10.01, z: 5 }), inside(q, { x: 5, z: -0.01 })], [true, true, false, false]);
});

test('landmarkCm resolves a zone package landmark as well as a town one', () => {
  const portal = PORTALS[0]!, at = landmarkCm(portal.zone, portal.landmark);
  assert.ok(Number.isFinite(at.x) && Number.isFinite(at.z));
  assert.throws(() => landmarkCm(portal.zone, 'no-such-landmark'), /no landmark/);
  assert.throws(() => landmarkCm('no-such-zone', 'gate'), /no landmark/);
});

test('exchangePlace: any trade zone opens the one shared bank; a non-trade zone, a stale pose or an unplaced player does not', async () => {
  const at = (zone: string | null, ageMs = 0): WhereFn => async () => ({ online: true, layer: 1, placed: true, x: 0, z: 0, zone, ageMs });
  for (const id of TRADE_ZONES) assert.equal(await exchangePlace(at(id), 'a'), BANK_PLACE, `${id} opens the bank`);
  assert.equal(await exchangePlace(at('pit-yard'), 'a'), undefined);
  assert.equal(await exchangePlace(at(null), 'a'), undefined);
  assert.equal(await exchangePlace(at('exchange', 10 * 60 * 1000), 'a'), undefined, 'a stale pose counts as away');
  assert.equal(await exchangePlace(async () => ({ online: true, layer: 1, placed: false }), 'a'), undefined);
  assert.equal(await exchangePlace(undefined, 'a'), undefined);
});
