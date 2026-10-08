// RV40 (the Defensive trim) and the stance ERA: stances are live, so a v34..v39 record with a Defensive side was fought on the pre-trim row and must replay on it,
// byte for byte (Auditor HOLD on the first RV40 draft). The pinned digest below was computed on trunk BEFORE the trim existed (the same script, STANCES.defensive =
// block -150, recover 250), so it proves "unchanged", not "self-consistent". A v40 record, and every live/headless fight, runs the trimmed row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialPractice, stepPractice, PROFILES } from '../src/combat.ts';
import { decide, initialAi } from '../src/ai.ts';
import { underRecord } from '../src/detmath.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { createRecorder, packRecord, unpackRecord, RECORD_VERSION, type FightRecord } from '../src/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { DEFENSIVE_TRIM, FIRST_TRIM_VERSION, setDefensiveTrim } from '../src/stance.ts';
import { roundPose } from '../src/duel.ts';

const SEED = 4242, LEVEL = 6, TICKS = 900, OPP = 'veteran';
const live = () => { setPlayScale(playScaleFor(OPP, RECORD_VERSION)); setLateNotice(true); setStab(true); };
/** One fight with a Defensive hero (the AI drives it), recorded; the live era. */
function record(trim = true): { rec: FightRecord; digest: string } {
  live(); setDefensiveTrim(trim);
  try {
  const recorder = createRecorder({ build: 'abc1234', opponent: OPP, weapon: 'longsword', level: LEVEL, seed: SEED, stances: 'defensive' });
  let p = initialPractice(SEED, opponentAt(OPPONENTS[OPP], LEVEL), 'longsword', null, undefined, undefined, 'defensive'), ai = initialAi(SEED ^ 0x5bd1e995);
  for (let t = 0; t < TICKS && !p.finish; t++) {
    const w = decide(p.duel, 0, ai, PROFILES.normal); ai = w.ai;
    p = stepPractice(p, recorder.push(t === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[OPP], LEVEL));
  }
  return { rec: recorder.finish('abandoned'), digest: digestOf(p.duel) };
  } finally { setDefensiveTrim(true); }
}
const digestOf = (duel: unknown): string => createHash('sha256').update(JSON.stringify(duel)).digest('hex').slice(0, 16);
/** The record replayed the way the page does it (underRecord), to its last tick. */
function replay(r: FightRecord): string {
  return underRecord(r, () => {
    let p = initialPractice(r.seed, opponentAt(OPPONENTS[OPP], r.level), r.weapon, null, undefined, undefined, r.stances, r.pose);
    for (let t = 0; t < r.ticks; t++) p = stepPractice(p, r.intents[t]!, profileAt(OPPONENTS[OPP], r.level));
    return digestOf(p.duel);
  });
}
// Computed on trunk 6a97dcb31 (STANCES.defensive = damage -50, block -150, recover 250, window 250, counter 250): the pre-trim fight.
const PRE_TRIM = '48486560f522d049', PRE_TRIM_POSED = '263698ca389aac52';
const POSE = roundPose({ hero: { x: -2.3, z: 1.1 }, foe: { x: 1.7, z: -0.9 }, heroFacing: 0.6 });

test('the live era writes a stances fight as v40 and runs the trimmed row; its record replays to the same fight', () => {
  const { rec, digest } = record();
  assert.equal(DEFENSIVE_TRIM, true);
  assert.equal(rec.v, FIRST_TRIM_VERSION);
  const back = unpackRecord(packRecord(rec));
  assert.equal(back.v, 40); assert.equal(back.stances, 'defensive');
  assert.equal(replay(back), digest);
});

test('a v34..v39 Defensive record replays on the FROZEN pre-trim row: the digest computed on trunk before the trim, for every version in the window', () => {
  const { rec } = record(false);   // the fight is RECORDED on the pre-trim row too, as the pin was on trunk
  assert.equal(replay(unpackRecord(packRecord({ ...rec, v: 34 } as FightRecord))), PRE_TRIM, 'v34 (the only pre-40 stances writer)');
  assert.equal(replay(unpackRecord(packRecord({ ...rec, v: 38, pose: POSE } as FightRecord))), PRE_TRIM_POSED, 'v38 (a posed stances fight)');
  for (const v of [34, 35, 36, 37, 38, 39]) assert.equal(underRecord({ v }, () => DEFENSIVE_TRIM), false, `the era is off for v${v} (v35..v37 wrote no stance records and v39 is a group stream that cannot replay alone: the row is chosen by the version all the same)`);
  assert.equal(underRecord({ v: 40 }, () => DEFENSIVE_TRIM), true);
  assert.equal(DEFENSIVE_TRIM, true, 'the era flag is put back after a replay');
});

test('the gate matters: the trimmed row is a different fight from the pre-trim one on the same record', () => {
  const { rec } = record();
  assert.notEqual(replay(unpackRecord(packRecord(rec))), PRE_TRIM);
});

test('a v40 header must carry the stances flag: forged without it, the decoder refuses; the live writer packs v40', () => {
  const { rec } = record();
  const bytes = packRecord(rec); assert.equal(bytes[2], 40);
  let o = 3; for (let i = 0; i < 3; i++) o += 1 + bytes[o]!;   // build, opponent, weapon
  const forged = bytes.slice(); forged[o + 1] = 0;   // skill, then the flag byte
  assert.throws(() => unpackRecord(forged), /version 40 record names its stances/);
});
