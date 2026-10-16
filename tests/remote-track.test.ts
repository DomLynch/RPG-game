// Other players in Zone 1 (origins/preview/remote-track.ts): the ease between presence packets, the heading's short way round, the teleport snap, the cap and the forgetting.
import assert from 'node:assert/strict';
import test from 'node:test';
import { arc, createTrack, type Remote } from '../origins/preview/remote-track.ts';

const at = (id: number, x: number, z: number, heading = 0): Remote => ({ id, x, z, heading, anim: 0, flags: 0 });
const T = { tickMs: 100, slowestEvery: 5, snap: 6, cap: 3 };
const near = { x: 0, z: 0 };

test('a new remote stands where it was first seen; the next packet is reached over the time between packets, not at once', () => {
  const t = createTrack(T);
  t.push([at(1, 10, 0)], 0);
  assert.deepEqual(t.shown(0, near).map((s) => [s.x, s.z, s.speed]), [[10, 0, 0]]);
  t.push([at(1, 10.5, 0)], 100);   // one tick later, half a metre on: 5 m/s
  const half = t.shown(150, near)[0]!;
  assert.ok(Math.abs(half.x - 10.25) < 1e-9 && Math.abs(half.speed - 5) < 1e-9, `halfway at 150 ms: x ${half.x} speed ${half.speed}`);
  const done = t.shown(220, near)[0]!;
  assert.ok(done.x === 10.5 && done.speed === 0, 'arrived: at rest once the ease is done');
});

test('a packet landing mid-ease starts from where the remote is SHOWN (no jump), and a far player\'s slower packets stretch the ease (bounded by the slowest tier)', () => {
  const t = createTrack(T);
  t.push([at(1, 0, 10)], 0); t.push([at(1, 1, 10)], 100);
  const mid = t.shown(150, near)[0]!;   // 0.5 m along
  t.push([at(1, 1, 10)], 150);
  assert.ok(Math.abs(t.shown(150, near)[0]!.x - mid.x) < 1e-9, 'the new ease begins at the shown place');
  t.push([at(1, 2, 10)], 150 + 900);   // a far player: 900 ms between packets, capped at 5 ticks = 500 ms
  const s = t.shown(150 + 900 + 250, near)[0]!;
  assert.ok(s.x > 1 && s.x < 2 && Math.abs(s.speed - 2) < 1e-9, `500 ms ease over 1 m = 2 m/s, got ${s.speed} at x ${s.x}`);
});

test('a jump beyond the snap distance is a warp: shown there at once, at rest', () => {
  const t = createTrack(T);
  t.push([at(1, 0, 10)], 0); t.push([at(1, 40, 10)], 100);
  const s = t.shown(100, near)[0]!;
  assert.equal(s.x, 40); assert.equal(s.speed, 0);
});

test('the heading takes the short way round the circle', () => {
  assert.ok(Math.abs(arc(3.0, -3.0) - (2 * Math.PI - 6.0)) < 1e-9, 'across the +-PI seam');
  assert.ok(Math.abs(arc(-3.0, 3.0) + (2 * Math.PI - 6.0)) < 1e-9);
  const t = createTrack(T);
  t.push([at(1, 0, 10, 3.0)], 0); t.push([at(1, 0, 10, -3.0)], 100);
  const h = t.shown(150, near)[0]!.heading;
  assert.ok(h > 3.0 && h < 3.0 + (2 * Math.PI - 6.0), `eased across the seam, not back through 0: ${h}`);
});

test('the cap keeps the nearest to the hero (ties by id)', () => {
  const t = createTrack(T);
  t.push([at(5, 20, 0), at(2, 3, 0), at(9, 10, 0), at(4, 10, 0)], 0);
  assert.deepEqual(t.shown(0, near).map((s) => s.id), [2, 4, 9], 'nearest three; 4 before 9 at equal distance');
});

test('a packet carries only the entities due: ids missing from it stay, and are gone only after remoteExpire ms with no update', () => {
  const t = createTrack({ ...T, expire: 1500 });
  t.push([at(1, 3, 0), at(2, 5, 0)], 0);
  t.push([at(1, 3.2, 0)], 100);   // 2 is not due this tick: it stays
  assert.deepEqual(t.shown(100, near).map((s) => s.id), [1, 2]);
  t.push([at(1, 3.4, 0)], 1400);
  assert.deepEqual(t.shown(1400, near).map((s) => s.id), [1, 2], '1.4 s without an update: still there');
  assert.deepEqual(t.shown(1501, near).map((s) => s.id), [1], '2 had no update for more than 1.5 s: gone, its record with it');
  assert.equal(t.size(), 1);
});

test('an id that is reused after it expired starts fresh: it is shown where the new player is, never eased from the old one\'s last pose', () => {
  const t = createTrack({ ...T, expire: 1500, snap: 1000 });   // a snap far larger than the gap, so only the reset can explain the start
  t.push([at(7, 0, 5)], 0);
  assert.deepEqual(t.shown(2000, near).map((s) => s.id), [], 'expired');
  t.push([at(7, 30, 5)], 2100);   // someone else gets id 7
  const s = t.shown(2100, near)[0]!;
  assert.deepEqual([s.x, s.z, s.speed], [30, 5, 0], 'at the new player\'s place, at rest: no run from (0, 5)');
});

test('defaults read the presence tick, its interest cap and the preview snap row', () => {
  const t = createTrack();
  for (let i = 0; i < 60; i++) t.push([at(i, i, 0)], 0);
  assert.equal(t.shown(0, near).length, 40, 'the interest cap (nearCap 40)');
});
