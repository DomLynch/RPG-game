import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPractice, stepPractice } from '../../src/combat.ts';
import { OPPONENTS, opponentAt, profileAt, LEVELS } from '../../src/moves.ts';
import { createRecorder, type FightRecord } from '../../src/record.ts';
import { recordSpecials } from '../../src/replay.ts';
import { noTwist, stepTwist, type TwistFlag } from '../../src/twist.ts';
import { withBar } from '../preview/encounter-duel.ts';
import { liveSpecials, MAX_FIGHT_TICKS, verifyEncounter, type EncounterParams } from './encounter-verify.ts';

const ACTIONS = ['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'dodge', 'backstep', 'parry'] as const;
const lcg = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; };
type Spec = { enemy: 'knight' | 'veteran'; level: number; seed: number; bar?: number; flags?: TwistFlag[] };

// The client side, as the preview host plays it (pit-duel.ts): initialPractice, withBar, then per tick the quantized intent, stepPractice and stepTwist; recorded by the Pit's recorder.
function play(spec: Spec, intentSeed: number, maxTicks = 1500): { record: FightRecord; twist: string | null } {
  const { enemy, level, seed } = spec, flags = spec.flags ?? [], opponent = OPPONENTS[enemy], profile = profileAt(opponent, level), rand = lcg(intentSeed);
  const specials = liveSpecials(level);
  const rec = createRecorder({ build: 'test', opponent: enemy, weapon: 'longsword', level, seed, ...(specials ? { specials: true } : {}) });
  let p = initialPractice(seed, opponentAt(opponent, level), 'longsword', null, recordSpecials({ specials, level, opponent: enemy }));
  if (spec.bar && flags.some((f) => f.kind === 'one-health-bar')) p = withBar(p, spec.bar);
  let twist = noTwist(), outcome: 'killed' | 'died' | 'draw' | 'abandoned' = 'abandoned';
  for (let i = 0; i < maxTicks; i++) {
    const intent = rec.push({ move: { x: Math.round(rand() * 2 - 1), z: 1, yaw: 0, run: rand() < 0.4 }, action: rand() < 0.5 ? ACTIONS[Math.floor(rand() * ACTIONS.length)]! : null, guard: rand() < 0.1, lock: true });
    p = stepPractice(p, intent, profile);
    if (p.finish) { if (flags.length && p.finish.victim === 1) twist = stepTwist(p.duel, flags, twist).twist; outcome = p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died'; break; }
    if (flags.length) { twist = stepTwist(p.duel, flags, twist).twist; if (twist.outcome === 'fled' || twist.outcome === 'escaped') break; }
  }
  return { record: rec.finish(outcome), twist: twist.outcome };
}
const params = (s: Spec, over: Partial<EncounterParams> = {}): EncounterParams => ({ seed: s.seed, enemy: s.enemy, level: s.level, bar: s.bar ?? null, flags: s.flags ?? [], layer: null, ...over });
const finished = (spec: Spec) => { for (let k = 1; k < 60; k++) { const r = play(spec, k); if (r.record.outcome !== 'abandoned') return r; } throw new Error('no finished fight found'); };

test('a legitimate record verifies: the result is the sim\'s, win or loss', () => {
  for (const spec of [{ enemy: 'knight', level: 6, seed: 731 }, { enemy: 'veteran', level: 30, seed: 9 }] as Spec[]) {
    const { record } = finished(spec), v = verifyEncounter(record, params(spec));
    assert.equal(v.ok, true, v.ok ? '' : v.reason);
    if (v.ok) { assert.equal(v.ticks, record.ticks); assert.equal(v.result, record.outcome === 'killed' ? 'won' : 'lost'); assert.equal(v.twist, null); }
  }
});

test('the server\'s parameters win over the record\'s claims: a different seed, enemy, level or special phase is refused', () => {
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731 }, { record } = finished(spec);
  for (const [name, p] of [['seed', params(spec, { seed: 732 })], ['enemy', params(spec, { enemy: 'veteran' })], ['level', params(spec, { level: 7 })]] as const) {
    const v = verifyEncounter(record, p); assert.equal(v.ok, false, name);
  }
  assert.equal(verifyEncounter({ ...record, specials: true }, params(spec)).ok, false, 'a record that claims specials where the warden has none');
  const high: Spec = { enemy: 'veteran', level: 30, seed: 9 }, hi = finished(high).record;
  const noSpecials: Partial<FightRecord> = { ...hi }; delete noSpecials.specials;
  assert.equal(verifyEncounter(noSpecials as FightRecord, params(high)).ok, false, 'and the reverse');
});

test('a forged record is refused: a flipped outcome, a cut or padded intent list, a fight that outlives its end, a past-the-cap length', () => {
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731 }, { record } = finished(spec), p = params(spec);
  assert.equal(verifyEncounter({ ...record, outcome: record.outcome === 'killed' ? 'died' : 'killed' }, p).ok, false, 'flipped outcome');
  assert.equal(verifyEncounter({ ...record, ticks: record.ticks - 1, intents: record.intents.slice(0, -1) }, p).ok, false, 'cut short: it does not reach its end');
  const padded = { ...record, ticks: record.ticks + 5, intents: [...record.intents, ...record.intents.slice(-5)] };
  const v = verifyEncounter(padded, p); assert.equal(v.ok, false, 'padded past the finish'); if (!v.ok) assert.match(v.reason, /ended at tick/);
  assert.equal(verifyEncounter({ ...record, ticks: record.ticks + 1 }, p).ok, false, 'ticks that do not match the intents');
  const long = { ...record, ticks: MAX_FIGHT_TICKS + 1, intents: new Array(MAX_FIGHT_TICKS + 1).fill(record.intents[0]) };
  assert.equal(verifyEncounter(long, p).ok, false, 'longer than any fight');
  let diverged = 0; for (let i = 0; i < record.intents.length; i += 7) { const c = structuredClone(record); c.intents[i] = { ...c.intents[i]!, action: 'heavy', guard: false }; if (!verifyEncounter(c, p).ok) diverged++; }
  assert.ok(diverged > 0, 'a tampered intent changes the replay and is caught (at least once over the whole fight)');
});

test('the one-health-bar pool is the server\'s: a record played on the pool verifies with it and not without', () => {
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731, bar: 20, flags: [{ kind: 'one-health-bar' }] }, { record } = finished(spec);   // a tiny pool: the foe falls on the first hit, so the pool decides the result
  assert.equal(verifyEncounter(record, params(spec)).ok, true);
  assert.equal(verifyEncounter(record, params(spec, { bar: null })).ok, false, 'the same record against the foe\'s own bar');
});

test('a flee-at twist: the foe runs, both standing, a record with outcome "abandoned" verifies as a win with the twist named; any other outcome is refused', () => {
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731, flags: [{ kind: 'flee-at', percent: 99 }] };
  let found: ReturnType<typeof play> | null = null;
  for (let k = 1; k < 200 && !found; k++) { const r = play(spec, k); if (r.twist === 'fled') found = r; }
  assert.ok(found, 'a scripted fight where the foe flees');
  const v = verifyEncounter(found!.record, params(spec));
  assert.equal(v.ok, true, v.ok ? '' : v.reason);
  if (v.ok) { assert.equal(v.result, 'won'); assert.equal(v.twist, 'fled'); }
  assert.equal(verifyEncounter({ ...found!.record, outcome: 'killed' }, params(spec)).ok, false);
  assert.equal(verifyEncounter(found!.record, params(spec, { flags: [] })).ok, false, 'without the twist the fight goes on past the record\'s last tick');
});

test('a mob layer is refused (fail closed until the verifier can step it)', () => {
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731 }, { record } = finished(spec);
  const v = verifyEncounter(record, params(spec, { layer: 'wolf-pack' })); assert.equal(v.ok, false); if (!v.ok) assert.match(v.reason, /mob layer/);
});

test('the special-move phase rule covers every level and agrees with the Veteran rung', () => {
  const on = Array.from({ length: LEVELS }, (_, i) => liveSpecials(i + 1));
  assert.equal(on[0], false); assert.equal(on[LEVELS - 1], true); assert.equal(liveSpecials(0), false); assert.equal(liveSpecials(LEVELS + 1), false);
  assert.equal(on.indexOf(true), 15, 'level 16 is the first with specials (tests/match-specials-boundary.test.ts)');
});
