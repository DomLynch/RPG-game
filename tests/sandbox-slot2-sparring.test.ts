// sandbox-mech spell slot 2 on the Dummy: ?spell2= (and ?foespell=) reach a sparring fight, which sends no record; before this the Match read them in career and practice only, so SPELL 2 stayed empty on the Sparring Dummy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { SPELL_IDS } from '../src/fight/spell-cast.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';

const two = { id: SPELL_IDS[1]!, skill: 50 }, foe = { id: SPELL_IDS[2]!, skill: 50 };
const make = () => {
  const storage = { getItem: () => null, setItem: () => {} };
  (globalThis as { __SANDBOX_SPELL2__?: unknown }).__SANDBOX_SPELL2__ = two; (globalThis as { __SANDBOX_FOE_SPELL__?: unknown }).__SANDBOX_FOE_SPELL__ = foe;
  return new Match(OPPONENTS.goblin, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), spell2: () => two, lookSpell: () => ({ id: SPELL_IDS[0]!, skill: 0 }) }, 731, 'longsword', null, 16);
};

test('sparring against the dummy carries the second spell and the foe spell, and records nothing', () => {
  const m = make();
  m.startSparring({ weapon: 'longsword', difficulty: 'dummy', skill: null });
  assert.equal(m.mode, 'sparring');
  assert.equal(m.spell2?.id, two.id);
  assert.equal(m.practice.duel.fighters[0].spell2?.id, two.id);
  assert.equal(m.foeSpell?.id, foe.id);
  assert.equal(m.recorder, null);
});
