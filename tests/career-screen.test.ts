import assert from 'node:assert/strict';
import test from 'node:test';
import { ladderView, scoreLines } from '../src/career-screen.ts';

test('the ladder is ten titles of five rungs, with the rank\'s rung marked and every lower rung done', () => {
  const view = ladderView(0);
  assert.equal(view.length, 10); assert.ok(view.every((s) => s.rungs.length === 5));
  assert.deepEqual(view[0]!.rungs.map((r) => r.state), ['now', 'next', 'next', 'next', 'next']);
  const mid = ladderView(7);   // level = 1 + wins: 8 = Legionary III
  const flat = mid.flatMap((s) => s.rungs), now = flat.filter((r) => r.state === 'now');
  assert.equal(now.length, 1); assert.equal(now[0]!.label, 'Legionary III');
  assert.ok(flat.slice(0, 7).every((r) => r.state === 'done') && flat.slice(8).every((r) => r.state === 'next'));
  const top = ladderView(1000).flatMap((s) => s.rungs); assert.equal(top.at(-1)!.state, 'now'); assert.equal(top.at(-1)!.label, 'Origin V');
});

test('the scorecard lines are most-fought first, losses read "n (k left)" only after a walk-away, and the total closes the table', () => {
  const rows = [{ opponent: 'a', fights: 1, wins: 1, losses: 0, draws: 0, left: 0, last: [] }, { opponent: 'b', fights: 4, wins: 1, losses: 3, draws: 0, left: 1, last: [] }];
  const lines = scoreLines(rows, (o) => o.toUpperCase());
  assert.deepEqual(lines.map((l) => l.name), ['B', 'A', 'All fights']);
  assert.deepEqual(lines[0], { name: 'B', fights: 4, wins: 1, losses: '3 (1 left)' });
  assert.deepEqual(lines[2], { name: 'All fights', fights: 5, wins: 2, losses: '3 (1 left)' });
  assert.deepEqual(scoreLines([]), [{ name: 'All fights', fights: 0, wins: 0, losses: '0' }], 'a new fighter: just the total');
});
