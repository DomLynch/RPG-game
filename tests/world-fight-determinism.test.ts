// A world creature fight is played as a Match in sparring mode (origins/preview/pit-duel.ts) and re-simulated on the server as initialPractice + stepPractice (the Pit's verifier
// pattern). This pins that the two are the SAME fight at the same seed and intents, tick for tick, so a verified record means what the client played. A divergence names its first tick.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { Match } from '../src/match.ts';
import { mobLayer } from '../origins/mobs/kits.ts';
import { LEVELS, OPPONENTS, opponentAt, profileAt, type WeaponId } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { quantizeIntent } from '../src/record.ts';
import { recordSpecials } from '../src/replay.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import type { Intent } from '../src/duel.ts';

const ACTIONS = [null, 'light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'dodge', 'backstep', 'parry'] as const;
const intentAt = (rand: () => number, tick: number): Intent => quantizeIntent({
  move: { x: Math.round(rand() * 2 - 1), z: Math.round(rand() * 2 - 1) * (tick % 5 ? 1 : 0), yaw: (rand() - 0.5) * 0.2, run: rand() < 0.3 },
  action: rand() < 0.35 ? ACTIONS[1 + Math.floor(rand() * (ACTIONS.length - 1))] : null, guard: rand() < 0.2, lock: true,
});
const lcg = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; };
const sparring = (opponent: keyof typeof OPPONENTS, seed: number, level: number, weapon: WeaponId, layer?: 'brute' | 'skirmisher' | 'caster' | 'beast') => {
  const data = new Map<string, string>(), storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  const m = new Match(OPPONENTS[opponent], 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, seed, weapon, null, level);
  if (layer) m.layer = mobLayer(layer);   // as origins/preview/pit-duel.ts sets it before startSparring
  m.startSparring({ weapon, skill: null, difficulty: level });
  return m;
};

for (const [opponent, level, seed] of [['knight', 10, 731], ['knight', 24, 9001], ['veteran', 40, 123456], ['executioner', 46, 77]] as const) {
  test(`world fight == initialPractice + stepPractice: ${opponent} L${level} seed ${seed}`, () => {
    const m = sparring(opponent, seed, level, 'longsword'), rand = lcg(seed ^ level);
    let p = initialPractice(seed, opponentAt(OPPONENTS[opponent], level), 'longsword', null, recordSpecials({ specials: m.specials, level, opponent }));
    assert.deepEqual(p.duel, m.practice.duel, 'tick 0');
    for (let tick = 0; tick < 900; tick++) {
      const intent = intentAt(rand, tick);
      if (m.practice.finish) { assert.ok(p.finish, `the Match ended at tick ${tick} but initialPractice+stepPractice did not`); break; }
      const outcome = m.step(() => intent);
      p = stepPractice(p, intent, profileAt(OPPONENTS[opponent], level));
      assert.deepEqual(p.duel, m.practice.duel, `first diverging tick: ${tick + 1}`);
      assert.equal(!!p.finish, !!m.practice.finish, `finish at tick ${tick + 1}`);
      if (outcome === 'ended') break;
    }
  });
}
for (const layer of ['brute', 'skirmisher', 'caster', 'beast'] as const) {
  test(`world fight under the ${layer} mob layer == initialPractice + stepPractice(.., layer)`, () => {
    const seed = 555, level = 24, m = sparring('knight', seed, level, 'longsword', layer), rand = lcg(seed ^ level), mine = mobLayer(layer);
    let p = initialPractice(seed, opponentAt(OPPONENTS.knight, level), 'longsword', null, recordSpecials({ specials: m.specials, level, opponent: 'knight' }));
    assert.deepEqual(p.duel, m.practice.duel, 'tick 0');
    for (let tick = 0; tick < 900; tick++) {
      const intent = intentAt(rand, tick);
      if (m.practice.finish) break;
      const outcome = m.step(() => intent);
      p = stepPractice(p, intent, profileAt(OPPONENTS.knight, level), mine);
      assert.deepEqual(p.duel, m.practice.duel, `first diverging tick: ${tick + 1}`);
      if (outcome === 'ended') break;
    }
  });
}
test('Match specials rule over every level (the verifier derives the same expectation)', () => {
  const live: boolean[] = [];
  for (let level = 1; level <= LEVELS; level++) live.push(sparring('knight', 1, level, 'longsword').specials);
  assert.equal(live.length, LEVELS);
  assert.ok(live.some(Boolean) && live.some((v) => !v), 'both phases exist');
});

// The record the world duel keeps (origins/preview/world-record.ts) is what the server's verifier accepts, with the server's own parameters.
import { verifyEncounter } from '../origins/server/encounter-verify.ts';
import { recordWorldFight, worldRecord } from '../origins/preview/world-record.ts';
for (const [opponent, level, seed] of [['knight', 10, 731], ['veteran', 40, 123456]] as const) {
  test(`world fight record verifies: ${opponent} L${level} seed ${seed}`, () => {
    const m = sparring(opponent, seed, level, 'longsword', 'brute'), rand = lcg(seed ^ level);
    recordWorldFight(m, opponent, level, seed);
    for (let tick = 0; tick < 4000 && m.step(() => intentAt(rand, tick)) !== 'ended'; tick++);
    assert.ok(m.practice.finish, 'the fight finished');
    const record = worldRecord(m, m.practice.finish)!;
    assert.equal(worldRecord(m, m.practice.finish), null, 'once');
    const v = verifyEncounter(record, { seed, enemy: opponent, level, bar: null, flags: [], layer: 'brute' });
    assert.ok(v.ok, v.ok ? '' : v.reason);
  });
}
