// Coach mode slice 1 (src/coach.ts): the player's side driven by the warden's own brain. Three promises: (1) the human-reaction bounds are the AI's (no stance brain touches what a fighter SEES, none is quicker
// than the quickest warden), (2) a coached fight's record replays byte for byte like a played one (the record stores intents, so there is no RV and no new codec), (3) it is a pure function of seed + stance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { COACH_BRAINS, COACH_FIXED, coachProfile, createCoach } from '../src/coach.ts';
import { OPPONENTS, PROFILES, opponentAt, profileAt, type Level } from '../src/moves.ts';
import { createRecorder, decodeRecord, encodeRecord, RECORD_VERSION } from '../src/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { underRecord } from '../src/detmath.ts';
import { PICKS, type PickedStance } from '../src/stance.ts';

const LEVELS: Level[] = ['easy', 'normal', 'hard'];

test('no stance brain touches what the coach sees: reaction, tell reaction, anticipate, accuracy and discipline are the warden profile\'s own', () => {
  for (const level of LEVELS) for (const stance of PICKS) {
    const p = coachProfile(stance, level), base = PROFILES[level];
    for (const key of COACH_FIXED) assert.equal(p[key], base[key], `${stance}/${level}: ${key} must stay the warden's ${String(base[key])}`);
  }
  for (const stance of PICKS) for (const key of COACH_FIXED) assert.ok(!(key in COACH_BRAINS[stance]), `${stance}'s brain sets ${key}`);
});

test('the coach is never quicker than the quickest warden table: its reaction is the AI level\'s own', () => {
  const fastest = Math.min(...Object.values(PROFILES).map((p) => p.reaction));
  for (const level of LEVELS) for (const stance of PICKS) assert.ok(coachProfile(stance, level).reaction >= fastest, `${stance}/${level}`);
  assert.ok(coachProfile('neutral', 'hard').reaction >= PROFILES.hard.reaction);
});

// A coached Pit fight through the real path (initialPractice / stepPractice, a recorder pushing every intent), then the record encoded, decoded and replayed the way the verifier does.
const digestOf = (p: ReturnType<typeof initialPractice>) => createHash('sha256').update(JSON.stringify({ tick: p.duel.tick, fighters: p.duel.fighters, finish: p.finish })).digest('hex');
async function coachedFight(stance: PickedStance, seed: number, level = 6) {
  const opponent = OPPONENTS.veteran;
  setPlayScale(playScaleFor(opponent.id, RECORD_VERSION)); setLateNotice(true); setStab(true);   // a live fight's era, as scripts/record-replay-check.mjs
  const rec = createRecorder({ build: 'coach-test', opponent: opponent.id, weapon: 'longsword', level, seed, ...(stance === 'neutral' ? {} : { stances: stance }) });
  const coach = createCoach(stance, seed);
  let p = initialPractice(seed, opponentAt(opponent, level), 'longsword', null, undefined, undefined, stance === 'neutral' ? undefined : stance);
  for (let t = 0; t < 7200 && !p.finish; t++) p = stepPractice(p, rec.push(coach.step(p.duel)), profileAt(opponent, level));
  const record = rec.finish(p.finish ? (p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
  return { record, live: p };
}

for (const stance of PICKS) {
  test(`a coached fight (${stance}) is a played fight: its record encodes, decodes and replays byte for byte`, async () => {
    const { record, live } = await coachedFight(stance, 4242);
    assert.ok(record.intents.length > 100 && live.finish, 'the coach plays a fight to its end');
    const decoded = await decodeRecord(await encodeRecord(record));
    const replay = underRecord(decoded, () => {
      let p = initialPractice(decoded.seed, opponentAt(OPPONENTS.veteran, decoded.level), decoded.weapon, decoded.skill ?? null, undefined, undefined, decoded.stances);
      for (let t = 0; t < decoded.intents.length && !p.finish; t++) p = stepPractice(p, decoded.intents[t], profileAt(OPPONENTS.veteran, decoded.level));
      return p;
    });
    assert.equal(digestOf(replay), digestOf(live), 'the replay is the live coached fight, state for state');
    assert.equal(decoded.v, record.v, 'a coached record carries no version of its own: it is the version a played one would be');
  });
}

test('a coached fight is a pure function of seed and stance, and the stances play differently', async () => {
  const a = await coachedFight('defensive', 99), b = await coachedFight('defensive', 99), c = await coachedFight('aggressive', 99);
  assert.deepEqual(a.record.intents, b.record.intents, 'same seed and stance, same intents');
  assert.notDeepEqual(a.record.intents, c.record.intents, 'a different stance plays a different fight');
});
