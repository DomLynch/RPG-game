// The Hades pilot's page (special-look.ts, ?special=hades): its link, its presentation stages, and Lead's two conditions: the page writes
// nothing (a sparring fight: no record, reward or stored row), and presentation never changes the fight it draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/match.ts';
import { OPPONENTS, RULES, opponentAt, profileAt } from '../src/moves.ts';
import { actorPose, initialPractice, stepPractice } from '../src/combat.ts';
import { stepDuel, withSpecials } from '../src/duel.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { SPECIAL_RECOVER, SPECIAL_TESTS, specialParam, specialStage } from '../src/special-look.ts';
import { STRATEGIES, act, arena, idle } from './strategies.ts';

test('?special=hades names the Nightborn at rank 9 (level 41); anything else is no test', () => {
  assert.equal(specialParam('?special=hades'), 'hades');
  assert.equal(specialParam('?opponent=goblin&special=HADES&debug'), 'hades');
  for (const search of ['', '?special=thor', '?special=', '?specials=hades']) assert.equal(specialParam(search), null, search);
  assert.deepEqual(SPECIAL_TESTS.hades, { opponent: 'nightborn', level: 41, first: 180 });
});

test('special stages: the windup runs 0..1 to the strike, then SPECIAL_RECOVER ticks of recovery, read off the sim state alone', () => {
  const S = RULES.special, d = withSpecials(arena(OPPONENTS.nightborn), 41, 'lunge'), f = d.fighters[1];
  assert.equal(specialStage(f), null, 'before the first cast');
  assert.deepEqual(specialStage({ ...f, special: S.windup }), { stage: 'windup', progress: 0 });
  assert.deepEqual(specialStage({ ...f, special: 1 }), { stage: 'windup', progress: 1 - 1 / S.windup });
  assert.deepEqual(specialStage({ ...f, special: 0, specialRecover: S.recovery }), { stage: 'recover', progress: 0 }, 'the strike tick');
  assert.deepEqual(specialStage({ ...f, special: 0, specialRecover: 1 }), { stage: 'recover', progress: (S.recovery - 1) / SPECIAL_RECOVER }, 'the last recovery tick');
  assert.equal(specialStage({ ...f, special: 0, specialRecover: 0 }), null, 'recovered');
  assert.equal(specialStage({ ...arena(OPPONENTS.nightborn).fighters[1], special: 5 }), null, 'no specials in the fight: nothing to draw');
});

// Dom's final rule (RULES.special, 2026-10-01) re-arms the cooldown at the RELEASE, so the recovery is read off the sim's own
// `specialRecover`, not off the cooldown: stepped through the real sim, the stage follows the cast with no gap and no late replay.
test('special stages through the real sim: windup to the release, recovery from the release tick for SPECIAL_RECOVER ticks, then nothing', () => {
  const S = RULES.special;
  let d = withSpecials(arena(OPPONENTS.nightborn), 41, 'lunge');
  d.fighters[1].skillCooldown = 0;
  assert.equal(SPECIAL_RECOVER, S.recovery, 'the drawn recovery is the sim\'s no-attack recovery');
  const stages: (string | null)[] = [];
  let released = -1;
  for (let i = 0; i < S.windup + SPECIAL_RECOVER + 200; i++) {
    d = stepDuel(d, [idle(), i === 0 ? act('skill') : idle()]);
    const f = d.fighters[1], stage = specialStage(f);
    if (released < 0 && !f.special && i > 0) { released = i; assert.deepEqual(stage, { stage: 'recover', progress: 0 }, 'the release tick opens the recovery'); }
    stages.push(stage?.stage ?? null);
  }
  assert.ok(released > 0, 'the cast released');
  assert.ok(stages.slice(0, released).every(s => s === 'windup'), 'windup on every tick to the release');
  assert.ok(stages.slice(released, released + SPECIAL_RECOVER).every(s => s === 'recover'), 'recovery on every tick after it');
  assert.ok(stages.slice(released + SPECIAL_RECOVER).every(s => s === null), 'and no second recovery later');
});

test('the ?special=hades page writes nothing: a sparring fight with specials, no recorder, no reward, no stored row', () => {
  const writes: string[] = [], store = new Map<string, string>(), storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { writes.push(k); store.set(k, v); } };
  const ports = { storage, trial: loadTrial(storage), scorecard: loadScorecard(storage), profile: loadProfile(storage, () => 'device').profile };
  const m = new Match(OPPONENTS.nightborn, 'dev', ports, 731);
  const before = writes.length, snapshot = () => JSON.stringify({ card: ports.trial.card, rows: ports.scorecard.rows, marks: ports.profile.career?.victoryMarks ?? 0 });
  const was = snapshot();
  m.startSparring({ weapon: 'longsword', difficulty: SPECIAL_TESTS.hades.level, skill: null }, { first: SPECIAL_TESTS.hades.first });
  assert.deepEqual([m.mode, m.specials, m.recorder, m.practice.duel.fighters[1].specialShare, m.practice.duel.fighters[1].skillCooldown], ['sparring', true, null, RULES.special.bossDamage, SPECIAL_TESTS.hades.first]);
  let result: string = 'stepped';
  for (let i = 0; i < 7200 && result === 'stepped'; i++) result = m.step(() => (m.practice.duel.fighters[0].phase === 'sheathed' ? act('light') : STRATEGIES['light spam'](m.practice.duel)));
  const ended = m.end(false);
  assert.deepEqual([ended.record, ended.rewarded], [null, false]);
  assert.equal(writes.length, before, `no storage write from the test fight (wrote ${writes.slice(before).join(', ')})`);
  assert.equal(snapshot(), was);
  m.rematch();
  assert.equal(m.specials, true, 'a rematch on the page keeps the test');
  m.playNow();
  assert.equal(m.specials, true, 'PLAY NOW returns to ordinary PvE specials');
  assert.deepEqual(m.practice.duel.fighters.map(f => f.skillCooldown), [RULES.special.first, RULES.special.first], 'the preview early-cast override is dropped');
});

test('presentation never changes the fight: the same seed steps to the same end whether or not every frame is posed', () => {
  const run = (posed: boolean) => {
    const level = SPECIAL_TESTS.hades.level, profile = profileAt(OPPONENTS.nightborn, level);
    let p = initialPractice(9, opponentAt(OPPONENTS.nightborn, level), 'longsword', null, { level, aiSkill: 'lunge' });
    for (let i = 0; i < 7200 && !p.finish; i++) {
      p = stepPractice(p, p.duel.fighters[0].phase === 'sheathed' ? act('light') : STRATEGIES['light spam'](p.duel), profile);
      if (posed) for (const side of [0, 1] as const) { actorPose(p, side); specialStage(p.duel.fighters[side]); }
    }
    return JSON.stringify({ tick: p.duel.tick, finish: p.finish, fighters: p.duel.fighters });
  };
  assert.equal(run(true), run(false));
});

test('the Pitborn grey-box pages: antaeus, surtr and typhon are his rank 8, 9 and 10 sparring pages, and his Cleave draws their art', async () => {
  const { isPitbornSpecial: isHadesShadow } = await import('../src/special-fx-pitborn.ts');
  for (const [name, level] of [['antaeus', 36], ['surtr', 41], ['typhon', 46]] as const) {
    assert.equal(specialParam(`?special=${name}`), name);
    assert.deepEqual(SPECIAL_TESTS[name], { opponent: 'pitborn', level, first: 180 });
  }
  assert.ok(isHadesShadow('pitborn', 1, 'skill_cleave'));
  assert.ok(!isHadesShadow('pitborn', 0, 'skill_cleave') && !isHadesShadow('pitborn', 1, 'skill_lunge'));
});
