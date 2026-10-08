// Seamless step 3, Match half (RV38): match.startPose is the open world's hero/foe positions; the next career/practice begin() fights from it,
// the record carries it (v38), a rematch goes back to the pit marks, and a lesson ignores it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/match.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { idleIntent, roundPose } from '../src/duel.ts';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, packRecord, unpackRecord, RECORD_VERSION } from '../src/record.ts';
import { playScaleFor, setPlayScale, setLateNotice } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';

const mk = () => {
  const storage = { getItem: () => null, setItem: () => undefined };
  return new Match(OPPONENTS.veteran, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'longsword', null, 6);
};
const pose = { hero: { x: -2.3, z: 1.1 }, foe: { x: 1.7, z: -0.9 }, heroFacing: 0.6 };
const at = (m: Match) => m.practice.duel.fighters.map((f) => [f.body.x, f.body.z]);

test('startPose: the next fight starts from it (float32-rounded), is recorded with it, and a rematch is back at the pit marks', () => {
  const m = mk(), marks = at(m);
  m.startPose = pose; m.rematch();
  const want = roundPose(pose);
  assert.deepEqual(at(m), [[want.hero.x, want.hero.z], [want.foe.x, want.foe.z]]);
  assert.equal(m.startPose, undefined, 'one shot');
  assert.deepEqual(m.recorder?.finish('abandoned').pose, want, 'the record carries the pose');
  m.rematch();
  assert.deepEqual(at(m), marks, 'the rematch starts at the marks');
});

test('startPose is dropped outside career/practice/sparring: a lesson starts at the marks', () => {
  const m = mk(), marks = at(m);
  m.startPose = pose; m.startLesson(() => undefined);
  assert.deepEqual(at(m), marks); assert.equal(m.startPose, undefined);
});

test('sparring takes the pose too (the open-world duel is a sparring Match): fightPose names it for the page that records, and the next sparring start is back at the marks', () => {
  const m = mk(), marks = at(m), want = roundPose(pose);
  m.startPose = pose; m.startSparring({ weapon: 'longsword', skill: null, difficulty: 6 });
  assert.deepEqual(at(m), [[want.hero.x, want.hero.z], [want.foe.x, want.foe.z]]); assert.deepEqual(m.fightPose, want); assert.equal(m.recorder, null);
  m.rematch(); assert.deepEqual(at(m), marks); assert.equal(m.fightPose, undefined);
});

test('a posed (v38) record replays from its own pose through Match.startReplay: the page-side replay is the recorded fight, not a desync from the pit marks', () => {
  const rec = createRecorder({ build: 'abc1234', opponent: 'veteran', weapon: 'longsword', level: 6, seed: 4242, pose: roundPose(pose) });
  setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true);
  let p = initialPractice(4242, opponentAt(OPPONENTS.veteran, 6), 'longsword', null, undefined, undefined, undefined, roundPose(pose));
  for (let t = 0; t < 90; t++) p = stepPractice(p, rec.push({ ...idleIntent(), action: t === 4 ? 'light' : null }), profileAt(OPPONENTS.veteran, 6));
  const record = unpackRecord(packRecord(rec.finish('abandoned'))), m = mk();
  assert.equal(record.v, 38);
  assert.ok(m.startReplay(record, 90, m.epoch));
  assert.deepEqual(m.practice.duel, p.duel, 'the replayed fight is the recorded one at tick 90');
  assert.equal(m.startPose, undefined);
});
