import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, TITLES, awardMark, ladderDifficulty, levelOf, marksOf, rankFor } from '../src/career.ts';
import type { Profile } from '../src/profile.ts';

const at = (marks: number) => { const r = rankFor(marks); return `${[r.title, r.numeral].filter(Boolean).join(' ')} L${r.level}`; };

test('rank boundaries follow the 46-level ladder (Dom 2026-09-27): level = 1 + wins, one win per sub-rank, Origin at level 46', () => {
  assert.equal(at(0), 'Recruit I L1'); assert.equal(at(1), 'Recruit II L2'); assert.equal(at(4), 'Recruit V L5');
  assert.equal(at(5), 'Legionary I L6'); assert.equal(at(10), 'Gladiator I L11'); assert.equal(at(15), 'Veteran I L16');
  assert.equal(at(20), 'Champion I L21'); assert.equal(at(25), 'Praetorian I L26'); assert.equal(at(30), 'Master I L31');
  assert.equal(at(35), 'Primus I L36'); assert.equal(at(40), 'Invictus I L41'); assert.equal(at(44), 'Invictus V L45');
  assert.equal(at(45), 'Origin L46'); assert.equal(at(9999), 'Origin L46');
  assert.equal(TITLES.length, 10); assert.equal(MAX_LEVEL, 46); assert.equal(levelOf(0), 1); assert.equal(levelOf(45), 46); assert.equal(levelOf(500), 46);
});
test('labels read "<Title> <numeral>", and bad counts fall to the first rung instead of throwing', () => {
  assert.equal(rankFor(0).label, 'Recruit I'); assert.equal(rankFor(12).label, 'Gladiator III'); assert.equal(rankFor(45).label, 'Origin');
  for (const bad of [-5, 0.5, NaN, Infinity, -Infinity]) assert.equal(at(bad), 'Recruit I L1');
});
test('next names the class the bar climbs toward, empty at Origin', () => {
  assert.equal(rankFor(0).next, 'Legionary'); assert.equal(rankFor(12).next, 'Veteran');
  assert.equal(rankFor(44).next, 'Origin'); assert.equal(rankFor(45).next, '');
});
test('the class bar (Strategy 2026-09-27): a win lights one whole segment, never a partial fill; the fifth win is the next title at I with an empty bar', () => {
  assert.deepEqual(((r) => [r.title, r.numeral, r.step, r.fill])(rankFor(0)), ['Recruit', 'I', 0, 0]);
  assert.deepEqual(((r) => [r.title, r.numeral, r.step, r.fill])(rankFor(3)), ['Recruit', 'IV', 3, 0]);
  assert.deepEqual(((r) => [r.title, r.numeral, r.step, r.fill])(rankFor(5)), ['Legionary', 'I', 0, 0]);
  for (let marks = 0; marks <= 50; marks++) assert.equal(rankFor(marks).fill, 0, `marks ${marks}`);
  assert.deepEqual(((r) => [r.step, r.fill])(rankFor(45)), [0, 0]);
});
test('rank never moves backwards as marks grow', () => {
  const order = (marks: number) => { const r = rankFor(marks); return TITLES.indexOf(r.title) * 5 + ['I', 'II', 'III', 'IV', 'V', ''].indexOf(r.numeral); };
  for (let marks = 1; marks <= 300; marks++) assert.ok(order(marks) >= order(marks - 1), `marks ${marks}`);
});
test('a won duel adds exactly one mark to the device profile', () => {
  const profile: Profile = { version: 1, id: 'guest-12345678', name: 'Aldren' };
  assert.equal(marksOf(profile), 0);
  assert.equal(awardMark(profile), 1); assert.equal(awardMark(profile), 2);
  assert.deepEqual(profile.career, { victoryMarks: 2 });
});

test('the ladder difficulty follows the career: easy for the first 15 wins (a first fight is winnable), normal after, never hard', () => {
  assert.equal(ladderDifficulty(0), 'easy'); assert.equal(ladderDifficulty(14), 'easy');
  assert.equal(ladderDifficulty(15), 'normal'); assert.equal(ladderDifficulty(45), 'normal');
  assert.equal(ladderDifficulty(Number.NaN), 'easy', 'a bad count is a fresh fighter');
});
