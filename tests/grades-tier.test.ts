import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN_MARKS, TITLES, rankFor } from '../src/career.ts';
import { TIERS, isTier, levelOf, opponentAt, tierAt } from '../src/grades.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';

// The whole point of this field is that it CANNOT be a second ladder. If tierAt ever stops being the career rung's own title,
// a grade and a rank stop meaning one thing and the journal's "Praetorian iron" becomes a lie.
test('grades: an opponent\'s tier is the career rung the fight is made at, for every reachable mark count', () => {
  for (let marks = 0; marks <= ORIGIN_MARKS + 25; marks++) {
    const tier = tierAt(marks);
    assert.equal(tier, rankFor(marks).title, `marks ${marks}: the tier is the rank's own title, never a parallel ladder`);
    assert.ok(isTier(tier), `marks ${marks}: ${tier} is a Tier`);
  }
  assert.equal(TIERS, TITLES, 'TIERS is TITLES itself, not a copy — the identity this function rests on');
});

test('grades: the ladder runs Recruit..Origin and every tier is reachable by fighting', () => {
  assert.equal(tierAt(0), 'Recruit');
  assert.equal(tierAt(ORIGIN_MARKS), 'Origin');
  assert.equal(levelOf(tierAt(0)), 1);
  assert.equal(levelOf(tierAt(ORIGIN_MARKS)), TIERS.length);
  const reached = new Set<string>();
  for (let marks = 0; marks <= ORIGIN_MARKS; marks++) reached.add(tierAt(marks));
  assert.deepEqual([...reached], [...TIERS], 'every tier is reached, in order — a kit floor on an unreachable tier would never apply');
});

test('grades: a junk mark count degrades to Recruit rather than throwing', () => {
  for (const marks of [-1, -1000, Number.NaN, Number.POSITIVE_INFINITY, 0.5]) assert.equal(tierAt(marks), 'Recruit', `${marks} floors to the first rung`);
});

test('grades: opponentAt carries the id unchanged and the rung beside it, held recipes included', () => {
  for (const id of Object.keys(ROSTER) as OpponentId[]) {
    const met = opponentAt(id, 0);
    assert.equal(met.id, id, 'the id is untouched — drop identity, provenance and the journal key off it');
    assert.equal(met.tier, 'Recruit');
    assert.equal(opponentAt(id, ORIGIN_MARKS).tier, 'Origin', `${id} answers at the top of the ladder too`);
  }
  assert.equal(opponentAt('minotaur', 0).tier, 'Recruit', 'a held recipe still resolves: a saved encounter must not fail to load');
});
