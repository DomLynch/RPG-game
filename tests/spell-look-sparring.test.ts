// The ?spell look test (boss-telegraph.ts spellLook, Lead 2026-10-13): the hook makes the sim really cast, so it may ONLY reach a Match in sparring (the dummy, no record, pays nothing). Any fight that sends a record ignores it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { SPELL_IDS } from '../src/fight/spell-cast.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';

const look = { id: SPELL_IDS[0]!, skill: 0 };
const make = (lookSpell: boolean, level = 16) => {
  const storage = { getItem: () => null, setItem: () => {} };
  return new Match(OPPONENTS.goblin, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), ...(lookSpell ? { lookSpell: () => look } : {}) }, 731, 'longsword', null, level);
};

test('the look hook plus a paying fight: no spell on the Match, none in the record', () => {
  const m = make(true);
  assert.equal(m.mode, 'career');
  assert.equal(m.spell, undefined);
  assert.equal(m.practice.duel.fighters[0].spell, undefined);
  assert.notEqual(m.recorder, null, 'a career fight still records');
  assert.equal(JSON.stringify(m.recorder).includes(look.id), false, 'and the record names no spell');
});

test('the look hook in sparring against the dummy: the spell is on the player, nothing is recorded', () => {
  const m = make(true);
  m.startSparring({ weapon: 'longsword', difficulty: 'dummy', skill: null });
  assert.equal(m.mode, 'sparring');
  assert.equal(m.spell?.id, look.id);
  assert.equal(m.practice.duel.fighters[0].spell?.id, look.id);
  assert.equal(m.recorder, null);
  m.begin('career');
  assert.equal(m.spell, undefined, 'back in a paying fight the hook is ignored again');
});

test('without the hook sparring and career cast no spell', () => {
  const m = make(false);
  assert.equal(m.spell, undefined);
  m.startSparring({ weapon: 'longsword', difficulty: 'dummy', skill: null });
  assert.equal(m.spell, undefined);
});
