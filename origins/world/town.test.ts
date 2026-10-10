// The town generator (town.ts): same seed + wealth = the same town, the rings are where they say, the civic centre is always one of each, nothing overlaps, and wealth makes it grander.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateTown, ROAD_HALF, TOWN_NODES } from './town.ts';

const at = (l: { x: number; z: number }) => Math.hypot(l.x, l.z);

test('same seed and wealth give the same town; another seed gives another', () => {
  assert.deepEqual(generateTown('ferry', 0.5), generateTown('ferry', 0.5));
  assert.notDeepEqual(generateTown('ferry', 0.5).lots.map((l) => [l.x, l.z]), generateTown('cinder', 0.5).lots.map((l) => [l.x, l.z]));
});

test('every town has exactly one bank, one Pit board, one rankings board and two gates, all of them in the centre or at the rim', () => {
  for (const w of [0, 0.3, 0.7, 1]) {
    const t = generateTown('ferry', w), count = (k: string) => t.lots.filter((l) => l.kind === k).length;
    assert.deepEqual([count('bank'), count('board'), count('rankings'), count('gate')], [1, 1, 1, 2], `wealth ${w}`);
    for (const l of t.lots.filter((q) => q.ring === 0)) assert.ok(at(l) < 16, `${l.id} at ${at(l).toFixed(1)}`);
  }
});

test('the rings are bands: plaza inside, then shops, houses, then the edge', () => {
  const t = generateTown('cinder', 0.6), mean = (kind: string) => { const g = t.lots.filter((l) => l.kind === kind); return g.reduce((n, l) => n + at(l), 0) / g.length; };
  assert.ok(mean('bank') < mean('shop') && mean('shop') < mean('house') && mean('house') < mean('stall'), `${mean('bank')} ${mean('shop')} ${mean('house')} ${mean('stall')}`);
  for (const l of t.lots) assert.ok(at(l) + l.r <= t.radius + 1, `${l.id} outside the town radius`);
});

test('no two lots overlap, at any wealth and seed', () => {
  for (const seed of ['ferry', 'cinder', 'mere', 'ruin']) for (const w of [0, 0.25, 0.5, 0.75, 1]) {
    const t = generateTown(seed, w);
    for (let i = 0; i < t.lots.length; i++) for (let j = i + 1; j < t.lots.length; j++) {
      const a = t.lots[i]!, b = t.lots[j]!;
      if (a.kind === 'gate' || b.kind === 'gate') continue;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r - 1e-6, `${seed}/${w}: ${a.id} overlaps ${b.id}`);
    }
  }
});

test('wealth makes the town grander: more lots, a wider town, more pieces', () => {
  const poor = generateTown('ferry', 0), rich = generateTown('ferry', 1), pieces = (t: ReturnType<typeof generateTown>) => t.lots.reduce((n, l) => n + l.pieces.length, 0);
  assert.ok(rich.lots.length > poor.lots.length && rich.radius > poor.radius && pieces(rich) > pieces(poor), `${poor.lots.length}/${rich.lots.length}`);
});

test('only the kit\'s node names appear, shops carry a sign and a trade, banks a counter, houses a chimney', () => {
  const t = generateTown('ferry', 0.8);
  for (const l of t.lots) for (const p of l.pieces) assert.ok((TOWN_NODES as readonly string[]).includes(p.node), p.node);
  for (const l of t.lots.filter((q) => q.kind === 'shop')) assert.ok(l.trade && l.pieces.some((p) => p.node === 'sign'), l.id);
  assert.ok(t.lots.find((l) => l.kind === 'bank')!.pieces.some((p) => p.node === 'counter'));
  assert.ok(t.lots.filter((l) => l.kind === 'house').every((l) => l.pieces.some((p) => p.node === 'chimney')));
  assert.ok(t.lots.filter((l) => l.kind === 'gate').every((l) => l.pieces.some((p) => p.node === 'arch')));
});

test('no two lots overlap (gates included), over many seeds and wealths: a stall never blocks the road between the gate arches', () => {
  for (let i = 0; i < 60; i++) for (const w of [0, 0.3, 0.6, 1]) {
    const lots = generateTown(`audit${i}`, w).lots;
    for (let a = 0; a < lots.length; a++) for (let b = a + 1; b < lots.length; b++) assert.ok(Math.hypot(lots[a]!.x - lots[b]!.x, lots[a]!.z - lots[b]!.z) >= lots[a]!.r + lots[b]!.r - 1e-9, `audit${i} wealth ${w}: ${lots[a]!.id} overlaps ${lots[b]!.id}`);
  }
});

test('the road between the gate arches (the z axis, ROAD_HALF either side) is clear of every ring lot, footprint included, over many seeds and wealths', () => {
  for (let i = 0; i < 60; i++) for (const w of [0, 0.3, 0.6, 1]) for (const l of generateTown(`road${i}`, w).lots) {
    if (l.kind === 'gate' || l.ring === 0) continue;   // the gate arches are ON the road; the civic centre is placed before the rings
    assert.ok(Math.abs(l.x) >= ROAD_HALF + l.r - 1e-9, `road${i} wealth ${w}: ${l.id} (x ${l.x.toFixed(2)}, r ${l.r.toFixed(2)}) stands on the road`);
  }
});

test('the civic centre keeps its distance from where the road meets the plaza: no bank / board / rankings centre within 25 degrees of the road axis (+-z), over many seeds and wealths', () => {
  const ROAD_AXIS_MARGIN = (25 * Math.PI) / 180;
  for (let i = 0; i < 100; i++) for (const w of [0, 0.5, 1]) for (const l of generateTown(`civic${i}`, w).lots.filter((q) => q.ring === 0)) {
    const off = Math.atan2(Math.abs(l.x), Math.abs(l.z));   // angle off the nearest z axis direction, 0 = on the road
    assert.ok(off >= ROAD_AXIS_MARGIN, `civic${i} wealth ${w}: ${l.id} stands ${(off * 180 / Math.PI).toFixed(1)} degrees off the road axis`);
  }
});
