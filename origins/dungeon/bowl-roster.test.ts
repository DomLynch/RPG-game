// Dungeon 1's roster rows: the table loads against the real foes, every group compiles to a `roster: true` zone spawn row that passes the spawn row contract (validateMobRow) with the ring's own level band,
// leash/roam/spread come from the ring's width as the layout gives it (World's ringEdges, origins/zones/plan.ts), and zone 7's shipped `spawns.rows` ARE those rows (a drift test, so the data and the roster table
// can never disagree).
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBowlRings, ringAt, rosterPlacements, rosterRows, type BowlKnown, type RingEdges, type RowBase } from './bowl-roster.ts';
import RAW from './bowl-roster.json' with { type: 'json' };
import PROGRESSION from '../region1/progression.json' with { type: 'json' };
import ZONE1 from '../zone-rows/zone1.row.json' with { type: 'json' };
import ZONE2 from '../zone-rows/zone2.row.json' with { type: 'json' };
import ZONE7 from '../zone-rows/zone7.row.json' with { type: 'json' };
import { ringEdges } from '../zones/plan.ts';
import { frontierPlan } from '../preview/frontier-plan.ts';
import { validateMobRow, type MobRow, type RowContext } from '../../src/core/world/row.ts';

const edges: RingEdges = (zone, landmark) => ringEdges(zone, landmark);
const FOES = new Set((PROGRESSION.foes as { id: string }[]).map((f) => f.id));
const RING_LANDMARKS = new Set(['ring-outer', 'ring-middle', 'floor']);   // the marks World's bowl plan names (plan-rows.json zone 7)
const known: BowlKnown = { characters: FOES, zones: new Set(['7']), landmarks: () => RING_LANDMARKS };
const BASES = new Map<string, MobRow>([...(ZONE1.spawns.rows as unknown as MobRow[]), ...(ZONE2.spawns.rows as unknown as MobRow[])].map((r) => [r.id, r] as const));
const base = (c: string): RowBase | undefined => BASES.get(c);
const LOOKS = (ZONE7 as unknown as { mobLooks: { looks: Record<string, { opponent: string }> } }).mobLooks.looks;   // zone 7's own dress for its creatures (a creature with none draws as a capsule)
const ctx: RowContext = { look: (id) => LOOKS[id] ?? null, lootTables: new Set(frontierPlan().data.registry.lootTables.keys()) };
type RawRing = { zone: string; landmark: string; levels: number[]; aggro: number; roamShare: number; leashShare: number; groups: { id: string; character: string; camps: number }[] };
type Raw = { rings: { outer: RawRing; middle: RawRing; floor: RawRing } };
const clone = () => JSON.parse(JSON.stringify(RAW)) as Raw;

test('the shipped roster loads: three rings, bands ascend 1-2, 3-4, 5-6 from the outer ring in, every character is a real foe', () => {
  const rings = loadBowlRings(known);
  assert.deepEqual(rings.map((r) => r.id), ['outer', 'middle', 'floor']);
  assert.deepEqual(rings.map((r) => r.levels), [[1, 2], [3, 4], [5, 6]]);
  for (const r of rings) for (const g of r.groups) assert.ok(FOES.has(g.character), `${r.id}/${g.id}: ${g.character}`);
});

test('the layout gives every ring an edge pair, and the three rings tile the bowl: floor, middle, outer, no gap and no overlap', () => {
  const rings = loadBowlRings(known), e = rings.map((r) => ringEdges(r.zone, r.landmark));
  assert.ok(e.every((x) => x !== null), 'every ring landmark resolves through ringEdges');
  const [outer, middle, floor] = e as { inner: number; outer: number }[];
  assert.equal(floor!.inner, 0);
  assert.equal(floor!.outer, middle!.inner, 'the floor ends where the middle ring begins');
  assert.equal(middle!.outer, outer!.inner, 'the middle ring ends where the outer ring begins');
});

test('every group is one zone spawn row: roster: true, keyed by its character, its ring\'s level band, and it passes the spawn row contract', () => {
  const rings = loadBowlRings(known), rows = rosterRows(rings, edges, base);
  assert.equal(rows.length, rings.reduce((n, r) => n + r.groups.length, 0));
  for (const row of rows) {
    const ring = rings.find((r) => r.groups.some((g) => g.character === row.id))!;
    assert.equal(row.roster, true, row.id);
    assert.deepEqual(row.level, ring.levels, row.id);
    assert.ok((row.behaviour.aggro ?? 0) > 0, `${row.id}: the bowl's creatures are aggressive`);
    assert.deepEqual(validateMobRow(row, ctx), [], `${row.id} breaks the spawn row contract`);
  }
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'one row per creature');
});

test('leash, roam and spread are the ring\'s width times its shares: the edges live in the layout, never in the roster', () => {
  const rings = loadBowlRings(known), rows = rosterRows(rings, edges, base);
  for (const row of rows) {
    const ring = rings.find((r) => r.groups.some((g) => g.character === row.id))!, e = ringEdges(ring.zone, ring.landmark)!, width = e.outer - e.inner, b = row.behaviour;
    assert.ok(Math.abs(b.spread! - width) < 0.06, `${row.id} spread`);
    assert.ok(Math.abs(b.roam! - width * ring.roamShare) < 0.06, `${row.id} roam`);
    assert.ok(Math.abs(b.leash! - width * ring.leashShare) < 0.06, `${row.id} leash`);
  }
  const wider: RingEdges = (z, l) => { const e = edges(z, l); return e && { inner: e.inner, outer: e.outer + 8 }; };
  const a = rosterRows(rings, edges, base).find((r) => r.id === rings[0]!.groups[0]!.character)!, b = rosterRows(rings, wider, base).find((r) => r.id === a.id)!;
  assert.ok(b.behaviour.leash! > a.behaviour.leash!, 'a wider ring from the layout widens the leash with no roster edit');
});

test('zone 7\'s shipped spawn rows are exactly the roster rows (a drift test): the data and the roster table cannot disagree', () => {
  assert.deepEqual(ZONE7.spawns.rows, rosterRows(loadBowlRings(known), edges, base), 'origins/zone-rows/zone7.row.json spawns.rows != the rows the roster table compiles to');
});

const LAYOUT = (ZONE7.place as unknown as { zones: Record<string, { layout: Record<string, unknown> }> }).zones['dungeon-bowl']!.layout;
const spotsOf = (landmark: string): string[] => Object.keys(LAYOUT).filter((k) => k.startsWith(`${landmark}-`));   // the plan's points that belong to a ring landmark: its name, a dash, the point's own name

test('rosterPlacements: one place.spawns entry per camp, anchored to a spot point of its own ring, dealt round the ring so no spot is reused before each has a camp', () => {
  const rings = loadBowlRings(known), placed = rosterPlacements(rings, spotsOf);
  assert.equal(placed.length, rings.reduce((n, r) => n + r.groups.reduce((m, g) => m + g.camps, 0), 0), 'one entry per camp');
  assert.equal(new Set(placed.map((p) => p.id)).size, placed.length, 'ids are unique');
  for (const r of rings) {
    const mine = placed.filter((p) => r.groups.some((g) => p.characters[0] === g.character));
    assert.ok(mine.every((p) => spotsOf(r.landmark).includes(p.at)), `${r.id}: every camp stands at its own ring's spot`);
    const spots = spotsOf(r.landmark), seen = new Set(mine.slice(0, spots.length).map((p) => p.at));
    assert.equal(seen.size, Math.min(spots.length, mine.length), `${r.id}: the first ${spots.length} camps take ${spots.length} different spots`);
  }
  assert.throws(() => rosterPlacements(rings, () => []), /nowhere to stand/);
});

test('zone 7\'s shipped place.spawns are exactly the roster placements (a drift test), and its band covers every roster row', () => {
  const rings = loadBowlRings(known);
  assert.deepEqual((ZONE7.place as unknown as { spawns: unknown }).spawns, rosterPlacements(rings, spotsOf), 'origins/zone-rows/zone7.row.json place.spawns != the placements the roster table compiles to');
  const band = (ZONE7 as unknown as { band: [number, number] }).band;
  for (const r of rings) assert.ok(r.levels[0] >= band[0] && r.levels[1] <= band[1], `${r.id} levels ${r.levels} sit in the zone band ${band}`);
});

test('ringAt: the centre is the floor, a point in each band its ring, the yard and beyond are no ring', () => {
  const rings = loadBowlRings(known);
  assert.equal(ringAt(rings, edges, 0), 'floor');
  assert.equal(ringAt(rings, edges, 12.9), 'floor');
  assert.equal(ringAt(rings, edges, 13), 'middle');
  assert.equal(ringAt(rings, edges, 25), 'outer');
  assert.equal(ringAt(rings, edges, 31), null);
});

test('the loader refuses what would put a creature wrong: overlapping bands, unknown creature/zone/landmark, an empty ring, roam above a third of the leash, a creature in two groups, a ring with no edges', () => {
  const bad = (edit: (d: Raw) => void, want: RegExp) => { const d = clone(); edit(d); assert.throws(() => loadBowlRings(known, d), want); };
  bad((d) => { d.rings.middle.levels = [2, 4]; }, /overlap/);
  bad((d) => { d.rings.outer.levels = [3, 1]; }, /levels must be/);
  bad((d) => { d.rings.outer.groups[0]!.character = 'character:nobody'; }, /not a known creature/);
  bad((d) => { d.rings.outer.zone = '9'; }, /not a zone/);
  bad((d) => { d.rings.outer.landmark = 'the-yard'; }, /no landmark/);
  bad((d) => { d.rings.floor.groups = []; }, /at least one group/);
  bad((d) => { d.rings.outer.aggro = 0; }, /aggro must be positive/);
  bad((d) => { d.rings.outer.roamShare = 1.5; }, /roamShare/);
  bad((d) => { d.rings.outer.roamShare = 0.5; }, /a third of leashShare/);
  bad((d) => { d.rings.outer.groups[1]!.id = d.rings.outer.groups[0]!.id; }, /twice/);
  bad((d) => { d.rings.middle.groups[0]!.character = d.rings.outer.groups[0]!.character; }, /two groups/);
  bad((d) => { d.rings.outer.groups[0]!.camps = 0; }, /camps/);
  assert.throws(() => rosterRows(loadBowlRings(known), () => null, base), /no edges/);
  assert.throws(() => rosterRows(loadBowlRings(known), () => ({ inner: 5, outer: 5 }), base), /no width/);
  assert.throws(() => rosterRows(loadBowlRings(known), edges, () => undefined), /no row to take/);
});
