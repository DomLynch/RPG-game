import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endOf, standingEnd } from './encounter-duel.ts';

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
