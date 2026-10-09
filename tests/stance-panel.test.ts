import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/match.ts';
import { OPPONENTS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { moodOf } from '../src/stance.ts';
import { stanceFlag, stanceLabel, stanceReveal } from '../src/stance-panel.ts';

// The stance preview (?stances=): off unless the URL asks, every live fight is as it was.
test('stances are ON by default: no flag, =1, =on and junk pick Balanced; =<pick> starts on it; ?stances=off is the kill switch and the only way off', () => {
  for (const q of ['', '?opponent=goblin', '?stances=', '?stances=bogus', '?stances=1', '?x=1&stances=on']) assert.equal(stanceFlag(q), 'neutral', q || '(no flag)');
  assert.equal(stanceFlag('?stances=off'), undefined); assert.equal(stanceFlag('?a=1&stances=off&b=2'), undefined);
  for (const p of ['neutral', 'aggressive', 'defensive', 'trickster'] as const) assert.equal(stanceFlag(`?stances=${p}`), p);
  assert.equal(stanceLabel('trickster'), 'Trickster');
  assert.equal(stanceLabel('neutral'), 'Balanced', 'the fourth stance is shown as Balanced; its id stays neutral');
});

test('the reveal names both stances: the player\'s pick and the opponent\'s mood drawn from the seed', () => {
  for (const seed of [1, 7, 731, 90210]) assert.equal(stanceReveal('aggressive', seed, 'goblin'), `You: Aggressive · goblin: ${moodOf(seed, 'goblin')[0].toUpperCase() + moodOf(seed, 'goblin').slice(1)}`);
});

const match = () => {
  const storage = { getItem: () => null, setItem: () => undefined };
  return new Match(OPPONENTS.veteran, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'longsword', null, 6);
};

test('Match: no pick = no stances (the page sets the default pick); a pick reaches a career fight, its record and its replay, never a lesson start, and a stances fight COUNTS', () => {
  const m = match(); m.rematch();
  assert.equal(m.stances, undefined); assert.equal(m.practice.duel.fighters[0].stance, undefined); assert.ok(m.practice.duel.fighters.every(f => !('stance' in f)), 'a live fight without the preview is the fight it always was');
  m.stancePref = 'defensive'; m.rematch();
  assert.equal(m.stances, 'defensive'); assert.equal(m.practice.duel.fighters[0].stance, 'defensive');
  assert.equal(m.practice.duel.fighters[1].stance, moodOf(m.seed, m.opponent.id) === 'neutral' ? undefined : moodOf(m.seed, m.opponent.id));
  assert.equal(m.practiceOnly, false, 'a stances fight COUNTS (stances ON for all, Dom 2026-10-08): marks, scorecard row and loot offer as any career fight');
  const plain = match(); plain.rematch(); assert.equal(plain.practiceOnly, false, 'and a fight with no pick is the career fight it always was');
  m.startLesson(() => undefined); assert.equal(m.stances, undefined, 'a lesson never carries stances');
});
