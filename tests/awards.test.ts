import assert from 'node:assert/strict';
import test from 'node:test';
import { awardFor, kitAt } from '../src/awards.ts';
import { LOOT } from '../src/loot.ts';

// The DB half (seed, verified win, guest convert, forged cache) is scripts/awards-database-check.mjs on real PostgreSQL; this is the rule.
test('the take is the claimed piece, armour or weapon, at the tier the fight was met at', () => {
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: 'veteran.Greaves' }, { marks: 14, owned: [] }), { piece: 'veteran.Greaves', tier: 1 });   // Recruit V
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: 'veteran.Greaves' }, { marks: 15, owned: [] }), { piece: 'veteran.Greaves', tier: 2 });   // Legionary I
  assert.deepEqual(awardFor({ opponent: 'goblin', piece: 'goblin.Knife' }, { marks: 205, owned: [] }), { piece: 'goblin.Knife', tier: 10 });
});

test('a claim is still a mark with nothing to award', () => {
  assert.equal(awardFor({ opponent: 'veteran', piece: null }, { marks: 14, owned: [] }), null);                        // the take declined
  assert.equal(awardFor({ opponent: 'veteran', piece: 'veteran.Body' }, { marks: 0, owned: ['veteran.Body'] }), null);   // already his
});

test('a piece outside the opponent\'s kit is refused', () => {
  for (const piece of ['veteran.Trident', 'goblin.Helmet', 'goblin.Axe', 'nonsense']) {
    assert.equal(typeof awardFor({ opponent: 'goblin', piece }, { marks: 0, owned: [] }), 'string', piece);
  }
  assert.equal(typeof awardFor({ opponent: 'minotaur', piece: 'veteran.Body' }, { marks: 0, owned: [] }), 'string');   // he carries no loot
});

test('the kit floor: a piece worn only from a later rung is refused below it', () => {
  const floor = { 'veteran.Crest': 'Gladiator' } as const;   // Gladiator starts at 30 marks
  assert.deepEqual(kitAt('veteran', 'Recruit'), LOOT.veteran);   // no table yet: every piece is worn from Recruit
  assert.ok(!kitAt('veteran', 'Legionary', floor).includes('veteran.Crest'));
  assert.equal(typeof awardFor({ opponent: 'veteran', piece: 'veteran.Crest' }, { marks: 29, owned: [] }, floor), 'string');
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: 'veteran.Crest' }, { marks: 30, owned: [] }, floor), { piece: 'veteran.Crest', tier: 3 });
});
