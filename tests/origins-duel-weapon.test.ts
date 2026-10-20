import assert from 'node:assert/strict';
import test from 'node:test';
import type { Match } from '../src/fight/index.ts';
import { recordWorldFight, worldRecord } from '../origins/preview/world-record.ts';

// An encounter / legend duel records the weapon the player fights with (the page's rig weapon, handed through pit-duel.ts DuelFight.weapon), which the encounter settle checks against the character's
// ledger main hand (origins/server/encounter-verify.ts); a duel that names none records the default longsword, which the settle always allows.
const recordedWeapon = (weapon?: Parameters<typeof recordWorldFight>[4]) => {
  const match = {} as Match;
  recordWorldFight(match, 'veteran', 3, 12345, weapon);
  return worldRecord(match, null)?.weapon;
};

test('recordWorldFight: the record carries the weapon the duel fights with, the longsword when none is named', () => {
  assert.equal(recordedWeapon('bow'), 'bow');
  assert.equal(recordedWeapon('staff'), 'staff');
  assert.equal(recordedWeapon(), 'longsword');
});
