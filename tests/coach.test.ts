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

// ---- the on/off switch, the hand-over and the `build` string (TOP10 row 8; the contract Web builds against) ----
import { BUILD_MAX, coachBuild, coachOfBuild, createCoachDriver } from '../src/coach.ts';
import { idleIntent, type Intent } from '../src/duel.ts';
import { kitOfBuild } from '../origins/mobs/kit-version.ts';

test('one intent per tick: the coach drives only while on, the player only while off; a press hands over on the SAME tick with the tap as that tick\'s input', () => {
  const seed = 7, opp = opponentAt(OPPONENTS.veteran, 6);
  const driver = createCoachDriver('aggressive', seed);
  let p = initialPractice(seed, opp, 'longsword', null);
  const tap: Intent = { ...idleIntent(), action: 'light' };
  const used: Array<'coach' | 'player'> = [];
  for (let t = 0; t < 400 && !p.finish; t++) {
    if (t === 20) driver.start(t);
    if (t === 200) driver.stop(t);          // a press: stop BEFORE this tick's pick
    const player = t === 200 ? tap : idleIntent();
    const intent = driver.pick(p.duel, player);
    if (!driver.on) assert.equal(intent, player, `tick ${t}: coach off, so the intent is the player's own`);   // the very object: the coach contributed nothing
    used.push(driver.on ? 'coach' : 'player');
    if (t === 200) assert.deepEqual(intent, tap, 'the tap that handed over IS that tick\'s input: nothing dropped');
    if (t >= 20 && t < 200) assert.equal(driver.on, true);
    p = stepPractice(p, intent, profileAt(OPPONENTS.veteran, 6));
  }
  assert.ok(used.slice(20, 200).every((u) => u === 'coach') && used.slice(200).every((u) => u === 'player') && used.slice(0, 20).every((u) => u === 'player'), 'coach exactly on [20,200), the player everywhere else');
  assert.deepEqual(driver.spans, [{ from: 20, to: 200 }]);
});

test('a hold the coach had is released the tick the player takes over unless the player holds it; start and stop are idempotent', () => {
  const driver = createCoachDriver('defensive', 3);
  let p = initialPractice(3, opponentAt(OPPONENTS.veteran, 6), 'longsword', null);
  driver.start(0); driver.start(5);          // a second start does not open a second span
  let guardedAtCoach = false;
  for (let t = 0; t < 600 && !guardedAtCoach; t++) { const i = driver.pick(p.duel, idleIntent()); if (i.guard) guardedAtCoach = true; p = stepPractice(p, i, profileAt(OPPONENTS.veteran, 6)); }
  assert.ok(guardedAtCoach, 'the defensive coach raises a guard within 600 ticks');
  driver.stop(p.duel.tick); driver.stop(p.duel.tick + 1);   // a second stop changes nothing
  assert.equal(driver.spans.length, 1); assert.notEqual(driver.spans[0]!.to, null);
  const released = driver.pick(p.duel, idleIntent());
  assert.equal(released.guard, false, 'the coach\'s guard is not carried into the player\'s tick');
  const holding = driver.pick(p.duel, { ...idleIntent(), guard: true });
  assert.equal(holding.guard, true, 'a player who holds guard keeps it');
});

test('the record build string: spans listed, kit tag last and still readable; over 255 bytes it falls back to @* and never cuts a span', () => {
  const spans = [{ from: 0, to: 1340 }, { from: 2100, to: null }];
  const b = coachBuild('abc1234', 'defensive', spans, 'k9z');
  assert.equal(b, 'abc1234 coach:defensive@0-1340,2100- kit:k9z');
  assert.equal(kitOfBuild(b), 'k9z'); assert.deepEqual(coachOfBuild(b), { stance: 'defensive', spans });
  assert.equal(coachBuild('abc1234', 'defensive', [], 'k9z'), 'abc1234 kit:k9z', 'no spans: not a coached record');
  const many = Array.from({ length: 80 }, (_, i) => ({ from: i * 100000 + 11, to: i * 100000 + 99999 }));   // far past 255 bytes
  const long = coachBuild('abc1234', 'trickster', many, 'k9z');
  assert.ok(long.length <= BUILD_MAX, `${long.length} bytes`);
  assert.equal(long, 'abc1234 coach:trickster@* kit:k9z'); assert.equal(kitOfBuild(long), 'k9z');
  assert.deepEqual(coachOfBuild(long), { stance: 'trickster', spans: null });
  const edge = []; let n = 0; while (coachBuild('abc1234', 'neutral', [...edge, { from: n * 10, to: n * 10 + 5 }], 'k9z').includes('@*') === false) { edge.push({ from: n * 10, to: n * 10 + 5 }); n++; }
  const justFits = coachBuild('abc1234', 'neutral', edge, 'k9z');
  assert.ok(justFits.length <= BUILD_MAX && !justFits.includes('@*'), 'the longest list that fits is written whole');
  assert.ok(coachBuild('abc1234', 'neutral', [...edge, { from: n * 10, to: n * 10 + 5 }], 'k9z').includes('@*'), 'one span more tips it to @*');
  assert.equal(coachOfBuild('abc1234 kit:k9z'), null, 'a played record has no coach token');
});
