import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent, roundPose, type DuelPose } from '../src/duel.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { FIRST_POSE_VERSION, NO_PATRON_VERSION, RECORD_VERSION, createRecorder, packRecord, unpackRecord, type RecordMeta } from '../src/record.ts';

// RV38 (Strategy's number, Combat 2026-10-08): the start pose in the record header. A headless recorder stamps an older era, so tests record as a live fight is fought.
const mk = (meta: RecordMeta) => { setPlayScale(playScaleFor(meta.opponent, RECORD_VERSION)); setLateNotice(true); setStab(true); return createRecorder(meta); };
const pose: DuelPose = roundPose({ hero: { x: -2.3, z: 1.1 }, foe: { x: 1.7, z: -0.9 }, heroFacing: 0.6 });
const meta: RecordMeta = { build: 'abc1234', opponent: 'veteran', weapon: 'longsword', level: 6, seed: 4242 };
const fight = (m: RecordMeta, ticks = 90) => {
  const rec = mk(m); let p = initialPractice(m.seed, opponentAt(OPPONENTS.veteran, m.level), m.weapon, null, undefined, undefined, undefined, m.pose);
  for (let t = 0; t < ticks; t++) { const i = rec.push({ ...idleIntent(), action: t === 4 ? 'light' : null }); p = stepPractice(p, i, profileAt(OPPONENTS.veteran, m.level)); }
  return { record: rec.finish('abandoned'), practice: p };
};

test('a posed fight is written as v38 with the pose flag, round-trips bit for bit, and replays from the same start', () => {
  const { record, practice } = fight({ ...meta, pose });
  assert.equal(record.v, FIRST_POSE_VERSION);
  const bytes = packRecord(record), back = unpackRecord(bytes);
  assert.deepEqual(back.pose, pose);
  assert.equal(back.v, FIRST_POSE_VERSION);
  let p = initialPractice(back.seed, opponentAt(OPPONENTS.veteran, back.level), back.weapon, null, undefined, undefined, undefined, back.pose);
  for (const i of back.intents) p = stepPractice(p, i, profileAt(OPPONENTS.veteran, back.level));
  assert.deepEqual(p.duel, practice.duel, 'the replay from the decoded pose is the recorded fight');
});

test('absent pose: the record keeps its old version and its old bytes (no pose flag, no extra 20 bytes)', () => {
  const { record } = fight(meta), bytes = packRecord(record);
  assert.equal(record.v, NO_PATRON_VERSION);
  const withPose = packRecord(fight({ ...meta, pose }).record);
  assert.equal(withPose.length - bytes.length, 21, 'five float32 plus the patron byte every v32+ header carries');
  assert.equal(unpackRecord(bytes).pose, undefined);
});

test('a pose is decoded without the live wall: a valid goblin pose 6 m out decodes whatever the last fight\'s circle was; a non-finite or overlapping one is still refused', () => {
  const far = roundPose({ hero: { x: -3, z: 5.1 }, foe: { x: 3, z: 5.2 }, heroFacing: 1 }), live = fight({ ...meta, opponent: 'goblin', pose: far }).record, bytes = packRecord(live);
  setPlayScale(playScaleFor('veteran', RECORD_VERSION));   // the page's last fight was Arena One: RADIUS 3.79, the pose is 6 m out
  assert.deepEqual(unpackRecord(bytes).pose, far);
});

test('a pose that is not float32, or that decodes with a non-finite number, is refused', () => {
  const rec = fight({ ...meta, pose }).record;
  assert.throws(() => packRecord({ ...rec, pose: { ...pose, heroFacing: 0.1 } }), /float32/);
  const bytes = packRecord(rec), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = bytes.length - 6 * rec.ticks - 1 - 4 - 4 - 1 - 20;   // header minus level, seed, ticks, outcome = the pose block
  const bad = bytes.slice(); new DataView(bad.buffer).setFloat32(at, NaN, true);
  assert.equal(dv.getFloat32(at, true), Math.fround(pose.hero.x), 'the offset lands on the first float');
  assert.throws(() => unpackRecord(bad), /unusable pose/);
});

test('a v38 record without its pose flag, and a pose on an older version, are refused', () => {
  const rec = fight({ ...meta, pose }).record, bytes = packRecord(rec);
  assert.throws(() => packRecord({ ...rec, v: 37 as never }), /pose on a version/);
  const flagAt = 3 + 1 + rec.build.length + 1 + rec.opponent.length + 1 + rec.weapon.length + 1;
  assert.equal(bytes[flagAt], 32, 'the flag byte is the pose bit alone');
  const noFlag = bytes.slice(); noFlag[flagAt] = 0;
  assert.throws(() => unpackRecord(noFlag), /names its pose/);
  const old = bytes.slice(); old[2] = 37;
  assert.throws(() => unpackRecord(old), /unknown specials flag/);
});

test('a live-recorded posed fight given an UNROUNDED pose records the rounded one and replays from it', () => {
  const raw: DuelPose = { hero: { x: -2.3, z: 1.1 }, foe: { x: 1.7, z: -0.9 }, heroFacing: 0.6 };
  const { record, practice } = fight({ ...meta, pose: raw });   // the fight itself starts from initialPractice(raw): rounded inside poseBodies
  assert.deepEqual(record.pose, roundPose(raw)); assert.notDeepEqual(record.pose, raw);
  const back = unpackRecord(packRecord(record));
  let p = initialPractice(back.seed, opponentAt(OPPONENTS.veteran, back.level), back.weapon, null, undefined, undefined, undefined, back.pose);
  for (const i of back.intents) p = stepPractice(p, i, profileAt(OPPONENTS.veteran, back.level));
  assert.deepEqual(p.duel, practice.duel);
});
