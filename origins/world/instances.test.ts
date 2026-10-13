// Private instances as a slot pool (row 24): the shipped row loads, the pool hands out the lowest free slot, keeps an owner's slot through the grace, frees it after graceS and maxS, says `full` at 25 owners,
// slot bands never overlap, and the headcount sets the spawn. Pure: no clock, the test passes `now`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { INSTANCE_KINDS, acquire, expire, leave, loadInstanceKinds, newPool, slotOrigin, spawnCount, type Pool } from './instances.ts';

const solo = INSTANCE_KINDS.solo!, row = (patch: object) => ({ kinds: { solo: { ...solo, ...patch } } });

test('the shipped solo row is 24 slots, 300 s grace, 900 s cap, one creature for one player; the loader refuses bad rows', () => {
  assert.deepEqual([solo.slots, solo.graceS, solo.maxS, spawnCount(solo, 1)], [24, 300, 900, 1]);
  assert.deepEqual(Object.keys(loadInstanceKinds({ kinds: INSTANCE_KINDS })), ['solo']);
  for (const [patch, why] of [[{ slots: 0 }, /slots/], [{ slots: 257 }, /slots/], [{ stride: 0 }, /stride/], [{ maxS: 0 }, /maxS/], [{ graceS: 901 }, /graceS/], [{ spawnBase: -1 }, /spawn/], [{ spawnPerPlayer: -0.5 }, /spawn/]] as const) assert.throws(() => loadInstanceKinds(row(patch)), why, JSON.stringify(patch));
});

test('acquire: the lowest free slot, one slot per owner, the same slot back for the same owner, `full` for the 25th', () => {
  let pool: Pool = newPool('solo');
  const slots: number[] = [];
  for (let i = 0; i < 24; i++) { const a = acquire(pool, `pc:${i}`, 0); assert.ok(a.ok && a.fresh); slots.push(a.slot); pool = a.pool; }
  assert.deepEqual(slots, [...Array(24).keys()], 'lowest free first');
  const again = acquire(pool, 'pc:7', 5); assert.ok(again.ok && !again.fresh && again.slot === 7, 'the same owner keeps their slot');
  const full = acquire(pool, 'pc:99', 5); assert.ok(!full.ok && full.reason === 'full');
});

test('leave keeps the slot for graceS (a return inside it is the same slot and cancels the leave), then expire frees it; maxS frees a slot even while its owner stays', () => {
  let pool = newPool('solo'); const a = acquire(pool, 'pc:a', 100); assert.ok(a.ok); pool = a.pool;
  const b = acquire(pool, 'pc:b', 100); assert.ok(b.ok); pool = b.pool;
  pool = leave(pool, 'pc:a', 200); assert.equal(leave(pool, 'pc:a', 250).slots[0]!.leftAt, 200, 'leaving twice keeps the first time');
  assert.equal(expire(pool, 499).slots[0]?.owner, 'pc:a', '299 s after leaving: still held'); assert.equal(expire(pool, 500).slots[0], null, '300 s after leaving: freed');
  const back = acquire(pool, 'pc:a', 400); assert.ok(back.ok && !back.fresh && back.slot === 0 && back.pool.slots[0]!.leftAt === null, 'a return inside the grace is the same slot, no longer left');
  assert.equal(expire(pool, 999).slots[1]?.owner, 'pc:b'); assert.equal(expire(pool, 1000).slots[1], null, 'maxS 900 s after it opened');
  const reuse = acquire(pool, 'pc:c', 500); assert.ok(reuse.ok && reuse.fresh && reuse.slot === 0, 'a freed slot is the next lowest free');
});

test('slot bands never overlap, and the headcount spawn is the base plus the per-player part past the first player', () => {
  const zs = Array.from({ length: solo.slots }, (_, i) => slotOrigin(solo, i, { x: 10, z: -20 }).z);
  assert.equal(new Set(zs).size, solo.slots); assert.equal(zs[1]! - zs[0]!, solo.stride); assert.equal(slotOrigin(solo, 3, { x: 10, z: -20 }).x, 10);
  const party = { ...solo, spawnBase: 2, spawnPerPlayer: 1.5 };
  assert.deepEqual([1, 2, 3, 4, 0, 2.9].map((n) => spawnCount(party, n)), [2, 3, 5, 6, 2, 3], 'floor(1.5 per extra player); a headcount under 1 counts as 1');
});
