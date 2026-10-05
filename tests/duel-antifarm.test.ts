import test from 'node:test';
import assert from 'node:assert/strict';
import { DUEL_ANTIFARM, decideDuelResult, expectedScore, taper, utcDay, type CountedWin } from '../src/net/duel-antifarm.ts';
import { PVP_REWARDS } from '../src/net/rewards.ts';

const DAY = DUEL_ANTIFARM.dayMs, now = 100 * DAY + 5 * 3600_000;
const base = { winnerId: 'a', loserId: 'b', verified: true, winnerTodayWins: [] as CountedWin[], now };

test('rewards are off: a counted win pays 0 and reports what it would have paid', () => {
  assert.equal(PVP_REWARDS, false);
  const d = decideDuelResult(base);
  assert.equal(d.counted, true); assert.equal(d.pay, 0); assert.equal(d.wouldPay, DUEL_ANTIFARM.reward.base);
  assert.equal(decideDuelResult({ ...base, rewardsOn: true }).pay, DUEL_ANTIFARM.reward.base, 'only the flag turns pay on');
});

test('rule 1, Elo: equal ratings move by K/2, an upset moves more than a favourite win, ratings never fall below the floor', () => {
  const even = decideDuelResult({ ...base, winnerRating: 1000, loserRating: 1000 });
  assert.equal(even.winner, 1000 + DUEL_ANTIFARM.elo.k / 2); assert.equal(even.loser, 1000 - DUEL_ANTIFARM.elo.k / 2);
  const upset = decideDuelResult({ ...base, winnerRating: 800, loserRating: 1200 }), favourite = decideDuelResult({ ...base, winnerRating: 1200, loserRating: 800 });
  assert.ok(upset.winner - 800 > favourite.winner - 1200);
  assert.equal(decideDuelResult({ ...base, winnerRating: 1000, loserRating: DUEL_ANTIFARM.elo.floor }).loser, DUEL_ANTIFARM.elo.floor);
  assert.equal(decideDuelResult({ ...base, winnerRating: null, loserRating: Number.NaN }).winner, DUEL_ANTIFARM.elo.start + DUEL_ANTIFARM.elo.k / 2, 'unknown ratings start at the start rating');
  assert.ok(Math.abs(expectedScore(1000, 1200) + expectedScore(1200, 1000) - 1) < 1e-12);
});

test('rule 2, first win per opponent per UTC day: a rematch win that day moves nothing and pays nothing; the next day it counts again', () => {
  const won: CountedWin[] = [{ opponent: 'b', at: now - 3600_000 }];
  const again = decideDuelResult({ ...base, winnerRating: 1000, loserRating: 1000, winnerTodayWins: won, rewardsOn: true });
  assert.equal(again.counted, false); assert.equal(again.reason, 'repeat-opponent'); assert.equal(again.pay, 0); assert.equal(again.wouldPay, 0);
  assert.equal(again.winner, 1000); assert.equal(again.loser, 1000);
  assert.equal(decideDuelResult({ ...base, winnerTodayWins: [{ opponent: 'c', at: now - 3600_000 }] }).counted, true, 'a different opponent counts');
  assert.equal(decideDuelResult({ ...base, winnerTodayWins: [{ opponent: 'b', at: now - DAY }] }).counted, true, 'yesterday\'s win over the same opponent does not block today');
  assert.equal(utcDay(100 * DAY - 1) + 1, utcDay(100 * DAY), 'the day turns over at UTC midnight');
});

test('rule 3, the daily taper: the first perFullWin wins pay in full, each further one pays less, down to the floor', () => {
  const { perFullWin, step, min } = DUEL_ANTIFARM.reward;
  for (let n = 0; n < perFullWin; n++) assert.equal(taper(n), 1, `win ${n + 1} pays in full`);
  assert.equal(taper(perFullWin), step); assert.equal(taper(perFullWin + 1), step * step);
  assert.equal(taper(100), min);
  const wins: CountedWin[] = Array.from({ length: perFullWin }, (_, i) => ({ opponent: `o${i}`, at: now - 1000 }));
  assert.equal(decideDuelResult({ ...base, winnerTodayWins: wins }).wouldPay, DUEL_ANTIFARM.reward.base * step, 'the (perFullWin+1)-th win of the day');
  const yesterday = wins.map((w) => ({ ...w, at: w.at - DAY }));
  assert.equal(decideDuelResult({ ...base, winnerTodayWins: yesterday }).wouldPay, DUEL_ANTIFARM.reward.base, 'yesterday\'s wins do not taper today');
});

test('nothing counts without a verified result, between one account and itself, or on a draw', () => {
  for (const [input, reason] of [[{ verified: false }, 'unverified'], [{ loserId: 'a' }, 'same-account'], [{ draw: true }, 'draw']] as const) {
    const d = decideDuelResult({ ...base, winnerRating: 1000, loserRating: 1000, rewardsOn: true, ...input });
    assert.equal(d.counted, false); assert.equal(d.reason, reason); assert.equal(d.pay, 0); assert.equal(d.winner, 1000);
  }
});
