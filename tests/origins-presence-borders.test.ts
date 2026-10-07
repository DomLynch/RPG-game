// Launch gate S3 (docs/specs/origins/launch-gates.md; one-shard.md §6 "Interest bugs"): players crossing the grid's cell borders are handed over correctly. Each pair that should
// see each other does, in both directions, with no ghost left behind in the cell a player came from and no entity sent twice. tests/origins-presence.test.ts covers the radius, the 40-nearest cap
// and the sockets; this file is the border cases. The oracle is a brute-force distance scan that never touches the grid, so a wrong cell index shows up as a difference.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeDown } from '../origins/presence/wire.ts';
import { RULES, World, type Player } from '../origins/presence/interest.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const { cellCm, radiusCm, nearCap, tiers } = RULES;
const put = (w: World, n: number, x: number, z: number): Player => w.join(acct(n), 0, undefined, { x, z })!;
const cellKey = (x: number, z: number): number => Math.floor(x / cellCm) * 4096 + Math.floor(z / cellCm);
const pose = (x: number, z: number) => ({ x, z, heading: 0, anim: 0, flags: 0 });

// What `p` should be sent at `tick`: every other player in the layer within the radius, nearest first, capped, each when due at its distance ring. No grid involved.
function expected(p: Player, tick: number): number[] {
  const others = [...p.layer.players.values()].filter(q => q !== p).map(q => ({ q, d: Math.hypot(q.x - p.x, q.z - p.z) })).filter(e => e.d <= radiusCm).sort((a, b) => a.d - b.d).slice(0, nearCap);
  return others.filter(({ q, d }) => (tick + q.id) % (tiers.find(t => d <= t[0]) ?? tiers[tiers.length - 1])[1] === 0).map(e => e.q.id).sort((a, b) => a - b);
}
const seen = (w: World, p: Player, tick: number): number[] => w.seenBy(p, tick).map(e => e.id);
// Every ring is due at least once in ten ticks (periods 1, 2 and 5), so the union over ten ticks is "everyone who is in range".
const inRange = (w: World, p: Player): number[] => [...new Set([...Array(10).keys()].flatMap(t => seen(w, p, t)))].sort((a, b) => a - b);

// The grid's own bookkeeping: every player is in exactly one cell, and it is the cell its position falls in. A ghost is a second entry or a stale one.
function assertGrid(w: World, what: string): void {
  for (const layer of w.layers.values()) {
    const homes = new Map<Player, number[]>();
    for (const [key, set] of layer.cells) for (const p of set) homes.set(p, [...(homes.get(p) ?? []), key]);
    assert.equal(homes.size, layer.players.size, `${what}: every cell entry is a live player (no ghost) and every player is in a cell`);
    for (const p of layer.players.values()) assert.deepEqual(homes.get(p), [cellKey(p.x, p.z)], `${what}: player ${p.id} sits in exactly its own cell`);
  }
}

test('borders: a walker crossing cell borders in x, in z and through a corner is seen exactly while within 40 m, by and of a still player, in both directions', () => {
  // The still player stands mid-cell; the walker crosses columns and rows, landing on exact multiples of the cell size (1,600 cm) on the way.
  const routes: { name: string; from: [number, number]; step: [number, number]; steps: number }[] = [
    { name: 'east along x', from: [3200, 8000], step: [100, 0], steps: 200 },
    { name: 'west along x', from: [13200, 8000], step: [-100, 0], steps: 200 },
    { name: 'north along z', from: [8000, 3200], step: [0, 100], steps: 200 },
    { name: 'south along z', from: [8000, 13200], step: [0, -100], steps: 200 },
    { name: 'diagonal, x and z cross a border on the same step', from: [3200, 3200], step: [70, 70], steps: 240 },
    { name: 'anti-diagonal', from: [13200, 3200], step: [-70, 70], steps: 240 },
  ];
  for (const route of routes) {
    const w = new World(RULES, 1);
    const still = put(w, 1, 8000, 8000), walker = put(w, 2, route.from[0], route.from[1]);
    let now = 0, bothSeen = 0;
    for (let s = 0; s < route.steps; s++) {
      now += 100;
      assert.equal(w.move(walker, pose(walker.x + route.step[0], walker.z + route.step[1]), now), 'ok', `${route.name}: the step is inside the speed clamp`);
      assertGrid(w, `${route.name} step ${s}`);
      const close = Math.hypot(walker.x - still.x, walker.z - still.z) <= radiusCm;
      assert.deepEqual(inRange(w, still), close ? [2] : [], `${route.name} step ${s}: the still player sees the walker exactly while it is in range`);
      assert.deepEqual(inRange(w, walker), close ? [1] : [], `${route.name} step ${s}: and the walker sees the still player, the other direction`);
      if (close) bothSeen++;
    }
    assert.ok(bothSeen > 20, `${route.name}: the route really passes through the radius (${bothSeen} steps)`);
  }
});

test('borders: a player standing exactly on a cell border, or on the zone edge, is seen from every side', () => {
  const w = new World(RULES, 1);
  const border = put(w, 1, 4800, 4800);   // x and z are both exact multiples of 1,600: a corner shared by four cells
  const ring = [[4800 - 3999, 4800], [4800 + 3999, 4800], [4800, 4800 - 3999], [4800, 4800 + 3999], [4800 + 2800, 4800 + 2800], [4800 - 2800, 4800 - 2800]];   // each within 40 m
  const around = ring.map(([x, z], i) => put(w, 10 + i, x, z));   // entity ids are the service's small slot numbers, not the account numbers
  assert.deepEqual(inRange(w, border), around.map(q => q.id).sort((a, c) => a - c), 'the corner player sees all six, one in every direction');
  for (const q of around) assert.ok(inRange(w, q).includes(border.id), `and ring player ${q.id} sees the corner player`);
  const w2 = new World(RULES, 1);
  const edge = put(w2, 1, 0, 0), far = put(w2, 2, RULES.zoneCm, RULES.zoneCm), mid = put(w2, 3, 2800, 2800);
  assert.deepEqual(inRange(w2, edge), [3], 'the zone corner at 0,0 sees only the player within 40 m');
  assert.deepEqual(inRange(w2, far), [], 'the opposite corner sees nobody, and its cell index does not collide with another');
  assert.deepEqual(inRange(w2, mid), [1], 'and mid sees the corner at 0,0');
  assertGrid(w2, 'zone corners');
});

test('borders: leaving from a border cell, and a player placed by a first pose, leave no ghost behind', () => {
  const w = new World(RULES, 1);
  const watcher = put(w, 1, 8000, 8000), onBorder = put(w, 2, 8000, 8000 + 1600);   // 8,000 is a cell border (5 x 1,600)
  assert.deepEqual(inRange(w, watcher), [2]);
  w.leave(onBorder, 100);
  assert.deepEqual(inRange(w, watcher), [], 'the watcher no longer sees a player who left from a border cell');
  assertGrid(w, 'after leave');
  // A player who joined with no known position starts at the spawn (the zone centre) and walks away in clamp-sized steps: the old cells must not keep it.
  const w2 = new World(RULES, 1);
  const centre = put(w2, 1, RULES.zoneCm / 2, RULES.zoneCm / 2);
  const late = w2.join(acct(2), 0)!;   // no `at`: the spawn, where the centre player sees it
  assert.deepEqual(inRange(w2, centre), [2], 'at the spawn it is where the centre player sees it');
  // 100 cm per 100 ms step is 10 m/s: 5 cm inside the speed clamp's reach for a 100 ms step (7 m/s x 1.5 = 105 cm), so every step is accepted but only just.
  for (let s = 1; s <= 5000; s++) { if (late.x >= 15000 + 4500) break; assert.equal(w2.move(late, pose(late.x + 100, late.z), s * 100), 'ok'); }
  assert.ok(late.x >= 15000 + 4500, 'it walked 45 m east, across several cell borders');
  assert.deepEqual(inRange(w2, centre), [], 'once past 40 m it is gone from the centre player\'s view: no ghost left in the cells it crossed');
  assert.deepEqual(inRange(w2, late), [], 'and it sees nobody from where it now stands');
  assertGrid(w2, 'after walking away from the spawn');
});

test('borders: a crowd random-walking across the whole zone matches a brute-force distance scan every tick, with no duplicate entity in any packet', () => {
  let seed = 12345;
  const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const w = new World(RULES, 1);
  const bots: Player[] = [];
  for (let i = 1; i <= 30; i++) bots.push(put(w, i, Math.round(rnd() * RULES.zoneCm), Math.round(rnd() * RULES.zoneCm)));   // 30 bots: the 40-nearest cap never binds, so the oracle is plain
  const heading = bots.map(() => rnd() * Math.PI * 2);
  let now = 0, comparisons = 0, nonEmpty = 0;
  for (let t = 0; t < 600; t++) {
    now += 100;
    bots.forEach((b, i) => {
      if (rnd() < 0.05) heading[i] = rnd() * Math.PI * 2;
      const x = Math.min(RULES.zoneCm, Math.max(0, Math.round(b.x + Math.cos(heading[i]!) * 90))), z = Math.min(RULES.zoneCm, Math.max(0, Math.round(b.z + Math.sin(heading[i]!) * 90)));
      if (x === b.x && z === b.z) heading[i] = rnd() * Math.PI * 2;
      assert.equal(w.move(b, pose(x, z), now), 'ok');
    });
    assertGrid(w, `tick ${t}`);
    const packets = w.tick(t);
    for (const b of bots) {
      const got = seen(w, b, t), want = expected(b, t);
      assert.deepEqual([...got].sort((a, c) => a - c), want, `tick ${t}, player ${b.id}: the grid and the brute-force scan agree`);
      assert.equal(new Set(got).size, got.length, `tick ${t}, player ${b.id}: no entity listed twice`);
      const packet = packets.get(b);
      assert.equal(packet !== undefined, want.length > 0, `tick ${t}, player ${b.id}: a packet exists exactly when there is something to send`);
      if (packet) { const ids = decodeDown(packet)!.entities.map(e => e.id); assert.deepEqual(ids.sort((a, c) => a - c), want, `tick ${t}, player ${b.id}: the encoded packet carries the same set, once each`); nonEmpty++; }
      comparisons++;
    }
  }
  assert.equal(comparisons, 600 * 30);
  assert.ok(nonEmpty > 1000, `the walk produced real traffic to compare (${nonEmpty} packets), not an empty zone`);
});
