// The moving cluster of the S1 load test's run R2c: the placement rules of origins/presence/cluster.ts (the script itself only drives sockets).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clusterCount, inSquare, newSquare, pointIn } from '../origins/presence/cluster.ts';

const ZONE = 30000;
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

test('cluster: 40% of 100 bots is 40, the share is rounded to a bot and clamped to 0..all', () => {
  assert.equal(clusterCount(100, 0.4), 40);
  assert.equal(clusterCount(300, 0.4), 120);
  assert.equal(clusterCount(7, 0.4), 3, 'rounded to the nearest bot');
  assert.equal(clusterCount(100, 0), 0, 'no cluster by default');
  assert.equal(clusterCount(100, 1.7), 100, 'never more than all');
  assert.equal(clusterCount(100, -1), 0, 'never negative');
});

test('cluster: every new 20 m square lies wholly inside the zone, however the dice fall, including the extremes', () => {
  const rand = seeded(7), size = 2000;
  for (let i = 0; i < 2000; i++) {
    const s = newSquare(rand, ZONE, size);
    assert.ok(s.x - size / 2 >= 0 && s.x + size / 2 <= ZONE && s.z - size / 2 >= 0 && s.z + size / 2 <= ZONE, `square ${i} at ${s.x},${s.z} is inside the zone`);
  }
  const low = newSquare(() => 0, ZONE, size), high = newSquare(() => 1, ZONE, size);
  assert.deepEqual([low.x, low.z, high.x, high.z], [1000, 1000, ZONE - 1000, ZONE - 1000], 'the corners of the allowed centres');
  assert.deepEqual(newSquare(() => 0.5, 1000, 5000), { x: 2500, z: 2500, sizeCm: 5000 }, 'a square bigger than the zone is centred rather than thrown');
});

test('cluster: a point chosen in the square is in the square, and inSquare agrees on the edge and just past it', () => {
  const rand = seeded(99), s = { x: 15000, z: 15000, sizeCm: 2000 };
  for (let i = 0; i < 500; i++) { const p = pointIn(s, rand); assert.ok(inSquare(s, p.x, p.z), `point ${i} is inside`); }
  assert.equal(inSquare(s, 16000, 15000), true, 'exactly on the edge');
  assert.equal(inSquare(s, 16001, 15000), false, 'one centimetre past it in x');
  assert.equal(inSquare(s, 15000, 13999), false, 'one centimetre past it in z');
  assert.deepEqual(pointIn(s, () => 0), { x: 14000, z: 14000 });
  assert.deepEqual(pointIn(s, () => 1), { x: 16000, z: 16000 });
});
