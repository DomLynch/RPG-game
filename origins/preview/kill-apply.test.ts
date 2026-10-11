import test from 'node:test';
import assert from 'node:assert/strict';
import { newCareer } from '../progression/model.ts';
import { applyServerKill } from './kill-apply.ts';
import type { Killed } from './spawn-net.ts';

const career = newCareer(0), session = { career, settled: new Set<string>(), fights: 0 };
const killed = (cp: number): Killed => ({ result: 'killed', instance: 'wolves-1', respawnAt: null, loot: [], cp, bronze: 3, beta: true });

test('a paid server kill moves the saved career on screen by exactly its CP, in the session and in the saved baseline', () => {
  const got = applyServerKill(session, { saved: career }, killed(20))!;
  assert.deepEqual([got.cp, got.session.career.credit, (got.source as { saved: { credit: number } }).saved.credit], [20, career.credit + 20, career.credit + 20]);
  assert.equal(session.career.credit, career.credit, 'the old session is not mutated');
});

test('nothing changes for an offline answer, an offline page (preview career), or a kill that paid 0', () => {
  assert.equal(applyServerKill(session, { saved: career }, { offline: 'timeout' }), null);
  assert.equal(applyServerKill(session, { offline: 'no-session' }, killed(20)), null);
  assert.equal(applyServerKill(session, { saved: career }, killed(0)), null);
});

import { killToast, NOT_SAVED, SIGN_IN_TO_KEEP } from './kill-apply.ts';
const name = (id: string) => (id === 'pelt' ? 'Wolf pelt' : id);
const withLoot: Killed = { ...killed(20), loot: [{ item: 'pelt', quantity: 2 }] };
test('the toast names the creature and shows the server\'s answer (cp, bronze, its loot), never a page number', () => {
  assert.equal(killToast(withLoot, name, 'Wolf'), 'Wolf is down. +20 CP · +3 bronze · Wolf pelt ×2.');
  assert.equal(killToast(withLoot, name, 'Wolf', true), 'Wolf is down. +20 CP · +3 bronze · Wolf pelt ×2. Bounty done.');
  assert.equal(killToast({ ...killed(20), loot: [] }, name, 'Wolf', true), 'Wolf is down. +20 CP · +3 bronze. Bounty done.');
  assert.equal(killToast({ ...withLoot, bronze: 0 }, name, 'Wolf', true), 'Wolf is down. +20 CP · Wolf pelt ×2. Bounty done.', 'no bronze: still Bounty done');
  assert.equal(killToast({ ...killed(0), bronze: 0 }, name, 'Wolf'), 'Wolf is down. Nothing paid.');
});
test('a guest keeps no loot and is told to sign in; a signed-in page the server did not answer says nothing was saved; neither shows a number', () => {
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf'), `Wolf is down. ${SIGN_IN_TO_KEEP}`);
  assert.equal(killToast({ offline: 'timeout' }, name, 'Wolf'), `Wolf is down. ${NOT_SAVED}`);
  assert.equal(killToast({ offline: 'no-session' }, name, 'Wolf', true), `Wolf is down. ${SIGN_IN_TO_KEEP} Bounty done.`);
});
