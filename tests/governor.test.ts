import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGovernor, GOVERNOR_ROW } from '../src/fight/governor.ts';

const row = { ...GOVERNOR_ROW, windowFrames: 4, overWindows: 2 };
const feed = (g: ReturnType<typeof createGovernor>, draws: number, tris: number, n: number) => Array.from({ length: n }, () => g.sample(draws, tris)).filter(Boolean);

test('a scene at the tier budget never pulls a lever', () => {
  const g = createGovernor(row, 'phone');
  assert.deepEqual(feed(g, g.budget.draws, g.budget.tris, 400), []);
  assert.equal(g.level, 0);
});

test('over budget for overWindows windows in a row pulls the ladder one lever at a time, then stops', () => {
  const g = createGovernor(row, 'phone');
  assert.deepEqual(feed(g, g.budget.draws + 1, 1, 4 * 2), ['shadows'], 'draws over, two windows');
  assert.deepEqual(feed(g, 1, g.budget.tris + 1, 4 * 2), ['crowd'], 'triangles over, two windows');
  assert.deepEqual(feed(g, 1e6, 1e9, 400), [], 'the ladder is spent: nothing more to pull');
  assert.equal(g.level, row.ladder.length);
});

test('one over window between two good ones resets the count (no flapping, no step on a single spike)', () => {
  const g = createGovernor(row, 'full');
  assert.deepEqual([...feed(g, g.budget.draws + 5, 1, 4), ...feed(g, 1, 1, 4), ...feed(g, g.budget.draws + 5, 1, 4)], []);
});

test('the median ignores a few spike frames inside a window', () => {
  const g = createGovernor(row, 'phone');
  assert.deepEqual([...feed(g, 1e6, 1, 1), ...feed(g, 1, 1, 3), ...feed(g, 1e6, 1, 1), ...feed(g, 1, 1, 3)], []);
});

test('the shipped rows: both tiers carry a budget and the ladder names real levers', () => {
  for (const t of ['phone', 'full']) assert.ok(GOVERNOR_ROW.tiers[t].draws > 0 && GOVERNOR_ROW.tiers[t].tris > 0);
  assert.deepEqual([...GOVERNOR_ROW.ladder], ['shadows', 'crowd']);
});
