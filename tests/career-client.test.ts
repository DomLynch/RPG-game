import assert from 'node:assert/strict';
import test from 'node:test';
import { readLeaderboards, readScorecard } from '../src/core/career-client.ts';

const db = (data: unknown, error: unknown = null, calls: unknown[][] = []) => ({ rpc: async (...args: unknown[]) => { calls.push(args); return { data, error }; } }) as never;
const row = { opponent: 'crixus', fights: 3, wins: 2, losses: 1, draws: 0, left_count: 1, last: ['win', 'loss'] };

test('the scorecard is scorecard_rows() mapped to the screen\'s rows; anything else (an error, a bad row, a throw) is null, never a throw', async () => {
  const calls: unknown[][] = [];
  assert.deepEqual(await readScorecard(db([row], null, calls)), [{ opponent: 'crixus', fights: 3, wins: 2, losses: 1, draws: 0, left: 1, last: ['win', 'loss'] }]);
  assert.deepEqual(calls, [['scorecard_rows']]);
  assert.deepEqual(await readScorecard(db([])), [], 'a new fighter has no rows: an empty table, not "unavailable"');
  assert.equal(await readScorecard(db(null, { message: 'no' })), null);
  assert.equal(await readScorecard(db([{ ...row, wins: -1 }])), null);
  assert.equal(await readScorecard(db([{ ...row, fights: 1.5 }])), null);
  assert.equal(await readScorecard(db([{ ...row, last: 'win' }])), null);
  assert.equal(await readScorecard({ rpc: async () => { throw new Error('offline'); } } as never), null);
});

test('the boards are leaderboards(p_limit) with the limit held to 1..50; a bad board name or place is null', async () => {
  const calls: unknown[][] = [];
  const good = [{ board: 'duel_rating', place: 1, display_name: 'Fighter #7', fighter_id: 7, score: 1500 }, { board: 'duel_wins', place: 1, display_name: 'Fighter #12', fighter_id: 12, score: 9 }];
  assert.deepEqual(await readLeaderboards(db(good, null, calls), 999), [{ board: 'duel_rating', place: 1, who: 'Fighter #7', fighterId: 7, score: 1500 }, { board: 'duel_wins', place: 1, who: 'Fighter #12', fighterId: 12, score: 9 }]);
  await readLeaderboards(db(good, null, calls), 0); await readLeaderboards(db(good, null, calls));
  assert.deepEqual(calls.map((c) => (c[1] as { p_limit: number }).p_limit), [50, 1, 20]);
  assert.equal(await readLeaderboards(db([{ ...good[0], board: 'ai' }])), null);
  assert.equal(await readLeaderboards(db([{ ...good[0], place: 0 }])), null);
  assert.equal(await readLeaderboards(db([{ ...good[0], display_name: '' }])), null);
  assert.equal(await readLeaderboards(db([{ ...good[0], fighter_id: 'x' }])), null, 'the public id is an integer');
  assert.equal(await readLeaderboards(db([{ board: 'duel_rating', place: 1, display_name: 'Fighter #7', score: 1 }])), null, 'a row without fighter_id (the old shape) is refused');
  assert.equal(await readLeaderboards(db(null, { code: '42501' })), null, 'signed out: the function is authenticated-only');
});
