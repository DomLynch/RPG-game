import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN_MARKS, TITLES, awardMark, marksOf, rankFor } from '../src/career.ts';
import type { Profile } from '../src/profile.ts';

const at = (marks: number) => { const r = rankFor(marks); return `${[r.title, r.numeral].filter(Boolean).join(' ')} ${r.filled}/${r.pips}`; };

test('rank boundaries follow the owner-locked ladder: 3 marks per sub-rank to Gladiator, 5 after, Origin at 205', () => {
  assert.equal(at(0), 'Recruit I 0/3'); assert.equal(at(2), 'Recruit I 2/3'); assert.equal(at(3), 'Recruit II 0/3');
  assert.equal(at(14), 'Recruit V 2/3'); assert.equal(at(15), 'Legionary I 0/3'); assert.equal(at(29), 'Legionary V 2/3');
  assert.equal(at(30), 'Gladiator I 0/5'); assert.equal(at(34), 'Gladiator I 4/5'); assert.equal(at(35), 'Gladiator II 0/5');
  assert.equal(at(55), 'Veteran I 0/5'); assert.equal(at(204), 'Invictus V 4/5');
  assert.equal(at(ORIGIN_MARKS), 'Origin 0/0'); assert.equal(rankFor(9999).title, 'Origin');
  assert.equal(TITLES.length, 10);
});
test('labels read as the spec writes them, and bad counts fall to the first rung instead of throwing', () => {
  assert.equal(rankFor(0).label, 'Recruit I · ○ ○ ○');
  assert.equal(rankFor(32).label, 'Gladiator I · ● ● ○ ○ ○');
  assert.equal(rankFor(ORIGIN_MARKS).label, 'Origin');
  for (const bad of [-5, 0.5, NaN, Infinity, -Infinity]) assert.equal(at(bad), 'Recruit I 0/3');
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
