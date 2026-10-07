import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice } from '../../src/combat.ts';
import { OPPONENTS } from '../../src/moves.ts';
import { endOf, standingEnd } from './encounter-duel.ts';
import { withBar } from '../shared/with-bar.ts';

test('the foe fell: a win; inside a catch window it is `caught`', () => {
  assert.deepEqual(endOf({ victim: 1 }, null), { result: 'won', twistOutcome: null });
  assert.deepEqual(endOf({ victim: 1 }, 'caught'), { result: 'won', twistOutcome: 'caught' });
});
test('the player fell, or a draw: a loss with no twist outcome, whatever the twist was', () => {
  assert.deepEqual(endOf({ victim: 0 }, null), { result: 'lost', twistOutcome: null });
  assert.deepEqual(endOf({ victim: 0 }, 'caught'), { result: 'lost', twistOutcome: null });
  assert.deepEqual(endOf({ victim: 1, draw: true }, 'caught'), { result: 'lost', twistOutcome: null });
  assert.deepEqual(endOf(null, null), { result: 'lost', twistOutcome: null });
});
test('a twist that ends the fight with both standing (fled, escaped) is a win carrying the outcome', () => {
  assert.deepEqual(standingEnd('fled'), { result: 'won', twistOutcome: 'fled' });
  assert.deepEqual(standingEnd('escaped'), { result: 'won', twistOutcome: 'escaped' });
});

test('one-health-bar stub: the foe starts with the summed pool as his bar and his health; the player and the rest are untouched', () => {
  const p = initialPractice(731, OPPONENTS.veteran), b = withBar(p, 350);
  assert.equal(b.health, 350); assert.equal(b.enemyMaxHealth, 350);
  assert.equal(b.playerHealth, p.playerHealth); assert.equal(b.maxHealth, p.maxHealth);
  assert.equal(b.duel.fighters[0], p.duel.fighters[0]);
});
