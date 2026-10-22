// Dungeon 1's roster rows: the table loads against the real foes, every group compiles to a `roster: true` spawn row with the ring's own level band, and leash/roam/spread come from the ring's width (a fixture
// stands in for World's bowl layout until its zone row lands: swap `BOWL_FIXTURE` for the real reader, the tests do not change).
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBowlRings, ringAt, rosterSpawns, type BowlKnown, type RingEdges } from './bowl-roster.ts';
import RAW from './bowl-roster.json' with { type: 'json' };
import PROGRESSION from '../region1/progression.json' with { type: 'json' };

/** FIXTURE (not the layout): the bowl's ring edges as the plan rows give them, from the centre (state doc 2026-10-22: outer r23-31, middle r13-23, Champion floor r<13). */
const BOWL_FIXTURE: Readonly<Record<string, { inner: number; outer: number }>> = { 'ring-outer': { inner: 23, outer: 31 }, 'ring-middle': { inner: 13, outer: 23 }, floor: { inner: 0, outer: 13 } };
const edges: RingEdges = (zone, landmark) => (zone === '7' ? BOWL_FIXTURE[landmark] ?? null : null);
const FOES = new Set((PROGRESSION.foes as { id: string }[]).map((f) => f.id));
const known: BowlKnown = { characters: FOES, zones: new Set(['7']), landmarks: () => new Set(Object.keys(BOWL_FIXTURE)) };
type RawRing = { zone: string; landmark: string; levels: number[]; aggro: number; roamShare: number; groups: { id: string; character: string; camps: number }[] };
type Raw = { rings: { outer: RawRing; middle: RawRing; floor: RawRing } };
const clone = () => JSON.parse(JSON.stringify(RAW)) as Raw;

test('the shipped roster loads: three rings, bands ascend 1-2, 3-4, 5-6 from the outer ring in, every character is a real foe', () => {
  const rings = loadBowlRings(known);
  assert.deepEqual(rings.map((r) => r.id), ['outer', 'middle', 'floor']);
  assert.deepEqual(rings.map((r) => r.levels), [[1, 2], [3, 4], [5, 6]]);
  for (const r of rings) for (const g of r.groups) assert.ok(FOES.has(g.character), `${r.id}/${g.id}: ${g.character}`);
});

test('every group is spawn rows with roster: true, its ring and its ring\'s level band; no ring is the safe yard', () => {
  const rings = loadBowlRings(known), rows = rosterSpawns(rings, edges);
  assert.equal(rows.length, rings.reduce((n, r) => n + r.groups.length, 0));
  for (const row of rows) {
    const ring = rings.find((r) => r.id === row.ring)!;
    assert.equal(row.roster, true, row.id);
    assert.deepEqual(row.level, ring.levels, row.id);
    assert.equal(row.zone, '7');
    assert.ok(row.behaviour.aggro > 0, `${row.id}: the bowl's creatures are aggressive`);
  }
  assert.ok(!rows.some((r) => r.ring === 'yard'), 'no spawn in the Pit yard');
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'ids are unique');
});

test('one character per roster group, and no character stands in two rings (a level band is one ring\'s)', () => {
  const rows = rosterSpawns(loadBowlRings(known), edges);
  const ringOf = new Map<string, string>();
  for (const r of rows) { assert.ok(!ringOf.has(r.character) || ringOf.get(r.character) === r.ring, `${r.character} in two rings`); ringOf.set(r.character, r.ring); }
});

test('leash, roam and spread are the ring\'s width times its shares: the edges live in the layout, never in the roster', () => {
  const rings = loadBowlRings(known), rows = rosterSpawns(rings, edges);
  for (const row of rows) {
    const ring = rings.find((r) => r.id === row.ring)!, e = BOWL_FIXTURE[ring.landmark]!, width = e.outer - e.inner;
    assert.ok(Math.abs(row.behaviour.spread - width) < 0.06, `${row.id} spread`);
    assert.ok(Math.abs(row.behaviour.roam - width * ring.roamShare) < 0.06, `${row.id} roam`);
    assert.ok(Math.abs(row.behaviour.leash - width * ring.leashShare) < 0.06, `${row.id} leash`);
    assert.ok(row.behaviour.leash <= width, `${row.id}: a creature is never pulled past its ring's width`);
  }
  const wider: RingEdges = (z, l) => { const e = edges(z, l); return e && { inner: e.inner, outer: e.outer + 8 }; };
  const a = rosterSpawns(rings, edges).find((r) => r.ring === 'outer')!, b = rosterSpawns(rings, wider).find((r) => r.ring === 'outer')!;
  assert.ok(b.behaviour.leash > a.behaviour.leash, 'a wider ring from the layout widens the leash with no roster edit');
});

test('ringAt: the centre is the floor, a point in each band its ring, the yard and beyond are no ring', () => {
  const rings = loadBowlRings(known);
  assert.equal(ringAt(rings, edges, 0), 'floor');
  assert.equal(ringAt(rings, edges, 12.9), 'floor');
  assert.equal(ringAt(rings, edges, 13), 'middle');
  assert.equal(ringAt(rings, edges, 25), 'outer');
  assert.equal(ringAt(rings, edges, 31), null);
});

test('the loader refuses what would put a creature wrong: overlapping bands, unknown creature/zone/landmark, an empty ring, a ring with no edges', () => {
  const bad = (edit: (d: Raw) => void, want: RegExp, k: BowlKnown = known) => { const d = clone(); edit(d); assert.throws(() => loadBowlRings(k, d), want); };
  bad((d) => { d.rings.middle.levels = [2, 4]; }, /overlap/);
  bad((d) => { d.rings.outer.levels = [3, 1]; }, /levels must be/);
  bad((d) => { d.rings.outer.groups[0]!.character = 'character:nobody'; }, /not a known creature/);
  bad((d) => { d.rings.outer.zone = '9'; }, /not a zone/);
  bad((d) => { d.rings.outer.landmark = 'the-yard'; }, /no landmark/);
  bad((d) => { d.rings.floor.groups = []; }, /at least one group/);
  bad((d) => { d.rings.outer.aggro = 0; }, /aggro must be positive/);
  bad((d) => { d.rings.outer.roamShare = 1.5; }, /roamShare/);
  bad((d) => { d.rings.outer.groups[1]!.id = d.rings.outer.groups[0]!.id; }, /twice/);
  bad((d) => { d.rings.outer.groups[0]!.camps = 0; }, /camps/);
  assert.throws(() => rosterSpawns(loadBowlRings(known), () => null), /no edges/);
  assert.throws(() => rosterSpawns(loadBowlRings(known), () => ({ inner: 5, outer: 5 })), /no width/);
});
