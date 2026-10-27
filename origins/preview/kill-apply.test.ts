import test from 'node:test';
import assert from 'node:assert/strict';
import { newCareer } from '../../src/core/index.ts';
import { applyServerKill } from './kill-apply.ts';
import type { Killed } from './spawn-net.ts';

const career = newCareer(), session = { career, settled: new Set<string>(), fights: 0 };
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

import { reportsKills } from './kill-apply.ts';
import { killCopy } from './legend-copy.ts';
import { allZoneIds, loadZone } from '../zones/loader.ts';
test('an UNLISTED zone (the Test Zone) sends no kill_report and its kill line says nothing was saved; a listed zone reports as before', () => {
  assert.equal(reportsKills(loadZone('1')), true, 'Zone 1 reports its kills');
  const unlisted = allZoneIds().filter((id) => loadZone(id, true).unlisted);
  assert.ok(unlisted.length > 0, 'the registry has an unlisted zone');
  for (const id of unlisted) assert.equal(reportsKills(loadZone(id, true)), false, `zone ${id} is unlisted: no kill_report`);
  assert.equal(killToast({ offline: 'unlisted' }, name, 'Wolf', false, null, true), 'Wolf is down. Not saved in the Test Zone.');
  assert.equal(killToast({ offline: 'unlisted' }, name, 'Wolf', true, null, true), 'Wolf is down. Not saved in the Test Zone. Bounty done.');
  assert.equal(killToast(withLoot, name, 'Wolf', false, null, false), 'Wolf is down. +20 CP · +3 bronze · Wolf pelt ×2.', 'sandbox false changes nothing for a listed zone');
});

// A ladder roster kill (the spawn row says `roster`, Dungeon 1) is a ladder win the writer settles within a minute (#3587): the toast says so, in words that are a row (kill-text.json), only for a kill the server took.
test('a ladder roster kill adds the pending line after what the server paid; a guest, an unsaved or a sandbox kill never does', async () => {
  const { default: TEXT } = await import('./kill-text.json', { with: { type: 'json' } });
  assert.equal(TEXT.toast.ladderPending, 'Ladder win pending.');
  assert.equal(killToast(withLoot, name, 'Bone Knight', false, null, false, null, true), 'Bone Knight is down. +20 CP · +3 bronze · Wolf pelt ×2. Ladder win pending.');
  assert.equal(killToast(withLoot, name, 'Bone Knight', true, null, false, null, true), 'Bone Knight is down. +20 CP · +3 bronze · Wolf pelt ×2. Bounty done. Ladder win pending.');
  assert.equal(killToast({ ...killed(0), bronze: 0 }, name, 'Bone Knight', false, null, false, null, true), 'Bone Knight is down. Nothing paid. Ladder win pending.');
  assert.equal(killToast(withLoot, name, 'Wolf', false, null, false, null, false), 'Wolf is down. +20 CP · +3 bronze · Wolf pelt ×2.', 'a plain creature says nothing about the ladder');
  assert.equal(killToast({ offline: 'no-session' }, name, 'Bone Knight', false, null, false, null, true), `Bone Knight is down. ${SIGN_IN_TO_KEEP}`, 'a guest has no ladder');
  assert.equal(killToast({ offline: 'timeout' }, name, 'Bone Knight', false, null, false, null, true), `Bone Knight is down. ${NOT_SAVED}`, 'an unanswered kill is not pending');
  assert.equal(killToast({ offline: 'unlisted' }, name, 'Bone Knight', false, null, true, null, true), 'Bone Knight is down. Not saved in the Test Zone.', 'an unlisted zone has no ladder');
  assert.equal(killToast(withLoot, name, 'Crixus', false, null, false, killCopy(), true), 'Crixus is defeated.\nReward: +20 CP · +3 bronze · Wolf pelt ×2. Ladder win pending.', 'a Pit legend (Dungeon 1) is defeated with a Reward line, then the pending line');
});
