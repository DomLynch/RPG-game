import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPractice, stepPractice } from '../../src/combat.ts';
import { OPPONENTS, opponentAt, profileAt, LEVELS } from '../../src/moves.ts';
import { createRecorder, type FightRecord } from '../../src/record.ts';
import { liveRecorder } from '../../tests/lib/live-recorder.ts';
import { recordSpecials } from '../../src/replay.ts';
import { noTwist, stepTwist, type TwistFlag } from '../../src/twist.ts';
import { mobLayer } from '../mobs/kits.ts';
import type { MobStyle } from '../mobs/styles.ts';
import { withBar } from '../shared/with-bar.ts';
import { liveSpecials, MAX_FIGHT_TICKS, verifyEncounter, type EncounterParams } from './encounter-verify.ts';
import { kitBuild } from '../mobs/kit-version.ts';
import { PICKS, type PickedStance } from '../../src/stance.ts';

const ACTIONS = ['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'dodge', 'backstep', 'parry'] as const;
const lcg = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; };
type Spec = { enemy: 'knight' | 'veteran'; level: number; seed: number; bar?: number; flags?: TwistFlag[]; layer?: MobStyle; stances?: PickedStance };

// The client side, as the preview host plays it (pit-duel.ts): initialPractice, withBar, then per tick the quantized intent, stepPractice and stepTwist; recorded by the Pit's recorder.
function play(spec: Spec, intentSeed: number, maxTicks = 1500): { record: FightRecord; twist: string | null } {
  const { enemy, level, seed } = spec, flags = spec.flags ?? [], opponent = OPPONENTS[enemy], profile = profileAt(opponent, level), rand = lcg(intentSeed);
  const specials = liveSpecials(level);
  const rec = (spec.stances ? liveRecorder : createRecorder)({ build: kitBuild('test'), opponent: enemy, weapon: 'longsword', level, seed, ...(specials ? { specials: true } : {}), ...(spec.stances ? { stances: spec.stances } : {}) });
  let p = initialPractice(seed, opponentAt(opponent, level), 'longsword', null, recordSpecials({ specials, level, opponent: enemy }), undefined, spec.stances);
  if (spec.bar && flags.some((f) => f.kind === 'one-health-bar')) p = withBar(p, spec.bar);
  const layer = spec.layer ? mobLayer(spec.layer) : undefined;
  let twist = noTwist(), outcome: 'killed' | 'died' | 'draw' | 'abandoned' = 'abandoned';
  for (let i = 0; i < maxTicks; i++) {
    const intent = rec.push({ move: { x: Math.round(rand() * 2 - 1), z: 1, yaw: 0, run: rand() < 0.4 }, action: rand() < 0.5 ? ACTIONS[Math.floor(rand() * ACTIONS.length)]! : null, guard: rand() < 0.1, lock: true });
    p = stepPractice(p, intent, profile, layer);
    if (p.finish) { if (flags.length && p.finish.victim === 1) twist = stepTwist(p.duel, flags, twist).twist; outcome = p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died'; break; }
    if (flags.length) { twist = stepTwist(p.duel, flags, twist).twist; if (twist.outcome === 'fled' || twist.outcome === 'escaped') break; }
  }
  return { record: rec.finish(outcome), twist: twist.outcome };
}
const params = (s: Spec, over: Partial<EncounterParams> = {}): EncounterParams => ({ seed: s.seed, enemy: s.enemy, level: s.level, bar: s.bar ?? null, flags: s.flags ?? [], layer: s.layer ?? null, ...over });
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

test('a mob layer is the server\'s: a record played under the layer verifies with it and not without; an unknown layer is refused', () => {
  let diverged = 0;
  for (const layer of ['brute', 'skirmisher', 'caster', 'beast'] as const) {
    const spec: Spec = { enemy: 'knight', level: 20, seed: 4242, layer }, { record } = finished(spec);
    const v = verifyEncounter(record, params(spec)); assert.equal(v.ok, true, `${layer}: ${v.ok ? '' : v.reason}`);
    if (!verifyEncounter(record, params(spec, { layer: null })).ok) diverged++;
  }
  assert.ok(diverged >= 1, 'at least one style changes the fight enough that its record fails without the layer');
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731 }, { record } = finished(spec);
  const v = verifyEncounter(record, params(spec, { layer: 'wolf-pack' })); assert.equal(v.ok, false); if (!v.ok) assert.match(v.reason, /mob layer/);
});

test('the special-move phase rule covers every level and agrees with the Veteran rung', () => {
  const on = Array.from({ length: LEVELS }, (_, i) => liveSpecials(i + 1));
  assert.equal(on[0], false); assert.equal(on[LEVELS - 1], true); assert.equal(liveSpecials(0), false); assert.equal(liveSpecials(LEVELS + 1), false);
  assert.equal(on.indexOf(true), 15, 'level 16 is the first with specials (tests/match-specials-boundary.test.ts)');
});

test('kit mismatch: a record played on another mob kit is refused as a kit mismatch (not judged, not a loss); no layer, no check', () => {
  const spec: Spec = { enemy: 'knight', level: 6, seed: 731, layer: 'brute' }, { record } = finished(spec);
  assert.equal(verifyEncounter(record, params(spec)).ok, true, 'the tag this build writes is the tag it checks');
  const other = verifyEncounter({ ...record, build: 'test kit:zzz' }, params(spec));
  assert.ok(!other.ok && other.kitMismatch === true && /kit mismatch.*zzz/.test(other.reason), JSON.stringify(other));
  const untagged = verifyEncounter({ ...record, build: 'origins-preview' }, params(spec));
  assert.ok(!untagged.ok && untagged.kitMismatch === true && /\(untagged\)/.test(untagged.reason), JSON.stringify(untagged));
  const plain: Spec = { enemy: 'knight', level: 6, seed: 731 }, { record: bare } = finished(plain);
  assert.equal(verifyEncounter({ ...bare, build: 'whatever' }, params(plain)).ok, true, 'a fight with no mob layer has no kit to disagree about');
});

// Stances ON for all (TOP10 row 7): a world fight played with a stance pick (RV34, src/record.ts) replays with that pick, as src/replay.ts does, and is paid like any other.
// A stance record is a LIVE-era record (createRecorder refuses one in an older era), so it is recorded with tests/lib/live-recorder.ts, which sets this build's live
// circle, late notice and stab globally: kept LAST in this file so no earlier test sees those globals.
test('a stances record verifies with its pick (v34), win or loss, for every pick', () => {
  for (const pick of PICKS) {
    const spec: Spec = { enemy: 'knight', level: 6, seed: 731, stances: pick }, { record } = finished(spec), v = verifyEncounter(record, params(spec));
    assert.equal(record.stances, pick);
    assert.equal(v.ok, true, v.ok ? '' : `${pick}: ${v.reason}`);
    if (v.ok) assert.equal(v.result, record.outcome === 'killed' ? 'won' : 'lost');
  }
});
