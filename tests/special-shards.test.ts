import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { createSpecialShards } from '../src/fight/special-shards.ts';
import { shardCapacity, shardRows, type ShardRow } from '../src/fight/sandbox-rules.ts';

// special-shards.ts (Donor: World of Claudecraft's solid impact fragments, MIT): presentation only. As shipped (no `specialShards` rows) nothing is built; the pool itself is tested with a row made here.
const row: ShardRow = { id: 'skullcrack-stone', skill: 'cleave', kind: 'stone', count: 6, tint: '#8a7a68', power: 1000, forward: 1500, lift: 1800, size: 90, life: 900, gravity: 9800, bounce: 350, slide: 400, shrink: 700 };

test('as shipped there are no shard rows, so the scene builds no pool', () => {
  assert.equal(shardRows(), 0);
  assert.equal(shardCapacity(), 0, 'and no pool capacity');
});

test('a burst throws at most its row count, in the pool of its kind, and the chips expire on their own', () => {
  const scene = new Scene(), shards = createSpecialShards(scene, row.count * 2);
  assert.equal(shards.alive(), 0);
  assert.equal(shards.burst(row, 0, 1, 0, 0, 1), 6);
  assert.equal(shards.alive(), 6);
  assert.equal(shards.burst({ ...row, kind: 'metal', count: 100 }, 0, 1, 0, 1, 0), row.count * 2, 'never more than the pool holds');
  shards.update(0.5); assert.ok(shards.alive() > 0);
  shards.update(5); assert.equal(shards.alive(), 0, 'every chip is gone after its life');
  shards.dispose();
});

test('a non-finite contact point or heading throws nothing; a zero heading still scatters', () => {
  const shards = createSpecialShards(new Scene(), row.count);
  assert.equal(shards.burst(row, Number.NaN, 1, 0, 0, 1), 0);
  assert.equal(shards.burst(row, 0, 1, 0, Number.POSITIVE_INFINITY, 1), 0);
  assert.equal(shards.burst(row, 0, 1, 0, 0, 0), 6);
  shards.update(Number.NaN); assert.equal(shards.alive(), 6, 'a bad dt does not advance time');
  shards.dispose();
});
