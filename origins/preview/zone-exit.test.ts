// Zone exits (zones/exits.ts rows, zone-exit.ts): a door from one zone page to another. The cave mouth in Zone 1 leads to the Bone Hollow's gate and back; the landing points equal the presence warp rows;
// a door fires once, only after the walker has been outside it, and the target address carries ?zone= and ?via=.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierPlan } from './frontier-plan.ts';
import { arrival, createZoneExit, doorsOf, exitHref } from './zone-exit.ts';
import { EXITS, exitSpots, loadExits } from '../zones/exits.ts';
import { loadZone, zoneIds } from '../zones/loader.ts';
import { warpPlace } from '../presence/warps.ts';
import { CENTRE_CM, ZONE_ROWS, walkable, zoneAt } from '../presence/zones.ts';
import { presenceRule } from '../presence/presence-rules.ts';

const cave = EXITS.find((r) => r.id === 'cave-mouth')!, gate = EXITS.find((r) => r.id === 'hollow-gate')!;
const m = (id: string): { x: number; z: number } => { const p = warpPlace(id)!; return { x: (p.x - CENTRE_CM) / 100, z: (p.z - CENTRE_CM) / 100 }; };

test('the rows: every exit joins two real zone pages and two real landmarks, and the pair is a round trip', () => {
  for (const r of EXITS) {
    const here = zoneIds().find((id) => loadZone(id).world.includes(r.zone))!, there = loadZone(r.to);
    assert.ok(here, `${r.id}: zone ${r.zone} belongs to a package`);
    assert.ok(doorsOf(frontierPlan(true, here), EXITS).some((d) => d.row === r), `${r.id}: its landmark stands on the ${here} page`);
    assert.ok(frontierPlan(true, r.to).zones.some((q) => q.landmarks[r.arrive]), `${r.id}: ${r.arrive} stands on the ${there.name} page`);
    assert.ok(warpPlace(r.warp), `${r.id}: ${r.warp} is a presence warp row`);
  }
  assert.equal(cave.to, '5'); assert.equal(gate.to, '1'); assert.equal(cave.arrive, gate.landmark); assert.equal(gate.arrive, cave.landmark);
  assert.throws(() => loadExits({ exits: [{ ...cave, radiusM: 0 }] }), /radiusM/);
  assert.throws(() => loadExits({ exits: [{ ...cave, arriveM: cave.radiusM }] }), /arriveM/);
});

test('the landing points: ARRIVE_M inside the far landmark, and the presence warp rows are those points', () => {
  for (const [pkg, via, warp] of [['5', 'cave-mouth', 'zone5-gate'], ['1', 'hollow-gate', 'zone1-cave-mouth']] as const) {
    const f = frontierPlan(true, pkg), a = arrival(f, pkg, via, EXITS)!, door = doorsOf(f, EXITS)[0]!;   // each page shows one door: the landmark he lands beside
    assert.ok(a, `${via} lands on the ${pkg} page`);
    assert.ok(Math.abs(Math.hypot(a.x - door.x, a.z - door.z) - a.row.arriveM) < 1e-6, 'arriveM from the landmark');
    assert.ok(Math.hypot(a.x - door.x, a.z - door.z) > door.row.radiusM, 'outside the door he came through: no bounce');
    assert.ok(Math.abs(m(warp).x - a.x) < 0.006 && Math.abs(m(warp).z - a.z) < 0.006, `${warp} is the landing point (${a.x}, ${a.z})`);
  }
  assert.equal(arrival(frontierPlan(true, '1'), '1', 'cave-mouth', EXITS), null, 'an exit that leads elsewhere lands nowhere here');
  assert.equal(arrival(frontierPlan(true, '1'), '1', null, EXITS), null);
});

test('presence: Zone 5 is listed, its ground is walkable, and it stands clear of every zone but its parent (presence sees by position, 40 m)', () => {
  const cm = (p: { x: number; z: number }) => ({ x: Math.round(CENTRE_CM + p.x * 100), z: Math.round(CENTRE_CM + p.z * 100) });
  for (const [pkg, via] of [['5', 'cave-mouth'], ['1', 'hollow-gate']] as const) { const a = arrival(frontierPlan(true, pkg), pkg, via, EXITS)!, p = cm(a); assert.ok(walkable(p.x, p.z), `${pkg}: the landing point is walkable`); }
  const door = doorsOf(frontierPlan(true, '5'), EXITS)[0]!, g = cm(door), land = cm(arrival(frontierPlan(true, '5'), '5', 'cave-mouth', EXITS)!);
  assert.ok(walkable(g.x, g.z), 'the gate is walkable (it sits on the edge shared with the marsh, which owns a shared edge)'); assert.equal(zoneAt(land.x, land.z), 'bone-hollow', 'the landing point stands in the bone-hollow row');
  const box = (c: readonly { x: number; z: number }[]) => ({ x0: Math.min(...c.map((q) => q.x)), x1: Math.max(...c.map((q) => q.x)), z0: Math.min(...c.map((q) => q.z)), z1: Math.max(...c.map((q) => q.z)) });
  const hollow = box(ZONE_ROWS.find((z) => z.id === 'bone-hollow')!.corners), sight = presenceRule('radiusCm') / 100;
  for (const z of ZONE_ROWS) {
    if (z.id === 'bone-hollow') continue;
    const o = box(z.corners), gap = Math.hypot(Math.max(0, hollow.x0 - o.x1, o.x0 - hollow.x1), Math.max(0, hollow.z0 - o.z1, o.z0 - hollow.z1));
    // it is mounted on the marsh's east edge (its parent), touching it and the corner of the salt flats: Zones 3 and 4 are placeholders nobody walks in the beta
    if (z.id !== 'drowned-marsh' && z.id !== 'salt-flats') assert.ok(gap >= sight, `${z.id} is ${gap.toFixed(0)} m from the Bone Hollow, inside presence's ${sight} m sight`);
  }
});

test('the door fires once, only after he has been outside it', () => {
  const sent: string[] = [], d = doorsOf(frontierPlan(true, '1'), EXITS)[0]!, ex = createZoneExit([d], (r) => sent.push(r.id));
  ex.update(d.x, d.z); ex.update(d.x + 0.5, d.z); assert.deepEqual(sent, [], 'landed inside the radius: not armed');
  ex.update(d.x + 10, d.z); ex.update(d.x + d.row.radiusM + 0.1, d.z); assert.deepEqual(sent, [], 'outside: armed, not fired');
  ex.update(d.x + d.row.radiusM - 0.1, d.z); assert.deepEqual(sent, ['cave-mouth']);
  ex.update(d.x, d.z); ex.update(d.x + 10, d.z); ex.update(d.x, d.z); assert.equal(sent.length, 1, 'once');
});

test('the address: the other zone, the exit taken, every other flag kept', () => {
  assert.equal(exitHref('https://x.test/preview/origins/?region=1&relief=0', cave), 'https://x.test/preview/origins/?region=1&relief=0&zone=5&via=cave-mouth');
  assert.equal(exitHref('https://x.test/zone/1/?kit=0', cave), 'https://x.test/zone/5/?kit=0&zone=5&via=cave-mouth');
});

test('the landing landmarks a page keeps are named by the rows', () => {
  assert.deepEqual([...exitSpots('5', ['bone-hollow'], EXITS)], ['hollow-gate']);
  assert.deepEqual([...exitSpots('1', ['cinder-fields'], EXITS)], ['cave-mouth']);
});
