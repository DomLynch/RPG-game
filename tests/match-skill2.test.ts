// SPECIAL 2 through the Match (the specials PR, RV75): a career fight takes the pick from its `skill2` port at every begin(), the fighter carries it, the record names it (stamped at the skill2 era), a replay of that record
// rebuilds the same slot b, an unknown id is no pick, and no port is the fight it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS, SKILL_MOVE, profileAt, type SkillId } from '../src/fight/moves.ts';
import { stepPractice } from '../src/fight/combat.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { FIRST_SKILL2_VERSION, RECORD_VERSION } from '../src/fight/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';

const mk = (skill2?: () => SkillId | undefined) => {
  const storage = { getItem: () => null, setItem: () => undefined };
  return new Match(OPPONENTS.veteran, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), ...(skill2 ? { skill2 } : {}) }, 731, 'longsword', null, 6);
};
const live = () => { setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true); };

test('a career Match takes SPECIAL 2 from its port at every begin(), the fighter carries it and the record names it', () => {
  live();
  let pick: SkillId | undefined = undefined;
  const m = mk(() => pick);
  m.rematch(); assert.equal(m.skill2, undefined); assert.ok(!('skill2' in m.practice.duel.fighters[0]), 'no pick: nothing added to the fighter');
  pick = 'stomp'; m.rematch();   // picked since the page booted
  assert.equal(m.skill2, 'stomp'); assert.equal(m.practice.duel.fighters[0].skill2, 'stomp'); assert.equal(m.practice.duel.fighters[1].skill2, undefined, 'the warden has none');
  const rec = m.recorder!.finish('abandoned');
  assert.equal(rec.skill2, 'stomp'); assert.ok(rec.v >= FIRST_SKILL2_VERSION, `a SPECIAL 2 fight is stamped at the skill2 era (${rec.v})`);
  pick = undefined; m.rematch(); assert.equal(m.skill2, undefined, 'the pick was cleared: the next fight has none');
});

test('the live press path: a skill2 intent through stepPractice starts the picked skill\'s own move on slot b\'s cooldown', () => {
  live();
  const m = mk(() => 'shove'); m.rematch();
  const press = (action: 'light' | 'skill2' | null) => ({ move: { x: 0, z: 0, yaw: 0, run: false }, action, guard: false, lock: true });
  let p = m.practice, started: string | undefined;
  const profile = profileAt(m.opponent, m.level);
  for (let t = 0; t < 80 && p.duel.fighters[0].phase !== 'ready'; t++) p = stepPractice(p, press(t === 0 ? 'light' : null), profile);   // a fresh fight starts sheathed: the first press draws (the same for the skill button)
  assert.equal(p.duel.fighters[0].phase, 'ready', 'drawn');
  const cooldownBefore = p.duel.fighters[0].skillCooldown;
  for (let t = 0; t < 8; t++) { p = stepPractice(p, press(t === 0 ? 'skill2' : null), profile); const e = p.duel.events.find((x) => x.type === 'AttackStarted' && x.actor === 0); if (e && !started) started = (e as { move: string }).move; }
  assert.equal(started, SKILL_MOVE.shove, 'the press fights through the picked skill\'s move row');
  assert.ok((p.duel.fighters[0].skillCooldown2 ?? 0) > 0, 'slot b cools'); assert.equal(Math.max(0, cooldownBefore - 8), p.duel.fighters[0].skillCooldown, 'slot a\'s clock is untouched by slot b');
});

test('an unknown id is no pick, and a replay rebuilds the record\'s own slot b', () => {
  live();
  const bad = mk(() => 'not-a-skill' as SkillId); bad.rematch(); assert.equal(bad.skill2, undefined);
  const m = mk(() => 'cleave'); m.rematch();
  const rec = m.recorder!.finish('abandoned');
  const r = mk(); r.rematch();   // a viewer with no pick of his own
  assert.equal(r.startReplay(rec, 0, r.epoch), true);
  assert.equal(r.skill2, 'cleave'); assert.equal(r.practice.duel.fighters[0].skill2, 'cleave', 'the replay is fought on the record\'s slot b, not the viewer\'s');
});
