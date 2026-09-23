import assert from 'node:assert/strict';
import test from 'node:test';
import { awardFor } from '../src/awards.ts';
import { dropFor } from '../src/loot.ts';
import { levelOf, tierAt } from '../src/grades.ts';

// The DB half (seed, verified win, guest convert, forged cache) is scripts/awards-database-check.mjs on real PostgreSQL; this is the rule.
test('an armour claim is dropFor at the server standing before the win, at that standing\'s tier', () => {
  for (const marks of [0, 14, 15, 204, 205]) {
    const owned = ['veteran.Helmet'];
    const drop = dropFor('veteran', marks, owned);
    assert.deepEqual(awardFor({ opponent: 'veteran', piece: null }, { marks, owned }), drop ? { piece: drop, tier: levelOf(tierAt(marks)) } : null);
  }
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: null }, { marks: 14, owned: [] }), { piece: 'veteran.Greaves', tier: 1 });
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: null }, { marks: 15, owned: [] }), { piece: 'veteran.Boots', tier: 2 });
});

test('a claim is still a mark with nothing to award', () => {
  assert.equal(awardFor({ opponent: 'veteran', piece: null }, { marks: 14, owned: ['veteran.Greaves'] }), null);   // the drop is already his
  assert.equal(awardFor({ opponent: 'minotaur', piece: null }, { marks: 0, owned: [] }), null);                    // he carries no loot
  assert.equal(awardFor({ opponent: 'veteran', piece: 'veteran.Trident' }, { marks: 0, owned: ['veteran.Trident'] }), null);
});

test('a take names a weapon the opponent carries, or the claim is refused', () => {
  assert.deepEqual(awardFor({ opponent: 'goblin', piece: 'goblin.Knife' }, { marks: 30, owned: [] }), { piece: 'goblin.Knife', tier: levelOf(tierAt(30)) });
  for (const piece of ['goblin.Body', 'veteran.Trident', 'goblin.Axe', 'nonsense']) {
    assert.equal(typeof awardFor({ opponent: 'goblin', piece }, { marks: 0, owned: [] }), 'string', piece);
  }
});
