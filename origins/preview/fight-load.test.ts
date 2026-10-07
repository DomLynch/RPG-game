// The duel chunk's failed load (fight-load.ts): restored whenever it is still this fight, the hint only for a player still fighting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFailure } from './fight-load.ts';

test('a failed duel load: still fighting restores and hints; left during the load restores without a hint; a replaced fight is left alone', () => {
  assert.equal(loadFailure(true, true), 'restore-and-hint');
  assert.equal(loadFailure(true, false), 'restore', 'the player left while the chunk loaded: the fight is still un-counted');
  assert.equal(loadFailure(false, true), 'none', 'another fight started since: this failure is stale');
  assert.equal(loadFailure(false, false), 'none');
});
