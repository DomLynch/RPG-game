// Wave A1 steps 6+7 (programme items 8, 7, 6; RV50): one-row proofs for each new row, and the opt-in proof that a fight naming none steps as before.
// CC timing (cc-ladder.ts windowFrom / immunity), a creature's immuneTier and resist (catalogue fields -> Fighter.ccGuard), and the swarm band (roll.ts SWARM_ROWS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, idleIntent, stepDuel, withRoll, type Action, type Duel, type Intent } from '../src/fight/duel.ts';
import { MOVES, RULES } from '../src/fight/moves.ts';
import { CC_LADDER, ccApply, ccRows, emptyLadder, guardOfLevel, type CcGuard, type CcKind, type CcLadder } from '../src/fight/cc-ladder.ts';
import { ROLL_BAND, SWARM_ROWS, percentOf, rollUnit, swarmBand } from '../src/fight/roll.ts';
import { TARGET } from '../src/fight/sim.ts';
import { DEFS } from '../src/fight/catalogue-rows.ts';
import { creature } from '../src/fight/world.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action): Intent => ({ ...idle(), action });
const light = MOVES.light_right, P = RULES.posture;
const duel = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });

// One light cut on a victim one cut from a posture break (tests/cc-ladder-engine.test.ts's setup), the victim carrying `cc` and `guard`.
function breakOnce(cc: CcLadder, guard?: CcGuard): number | null {
  const base = duel();
  let d: Duel = { ...base, fighters: [base.fighters[0], { ...base.fighters[1], posture: P.max - light.posture + 1 + light.windup * P.decay, cc, ...(guard ? { ccGuard: guard } : {}) }] };
  d = stepDuel(d, [act('light'), idle()]);
  const events = [...d.events];
  for (let i = 0; i < light.windup; i++) { d = stepDuel(d, [idle(), idle()]); events.push(...d.events); }
  return events.find((e) => e.type === 'PostureBroken')?.ticks ?? null;
}

test('the shipped rows (Lead\'s accepted numbers): window counted from the END, post-CC immunity stun 120 / knockdown 180, tiers and resists by rank band, no catalogue row names a tier or resist', () => {
  const imm: Record<string, number> = { stun: 120, knockdown: 180, root: 0 };
  for (const k of Object.values(CC_LADDER.kinds)) { assert.equal(k.immunity, imm[k.id], k.id); assert.equal(k.windowFrom, 'end', k.id); assert.deepEqual(k.steps, [100, 50, 25, 0], k.id); assert.equal(k.window, 900, k.id); }
  const r = ccApply(emptyLadder, 'postureBreak', 10, 120);
  assert.deepEqual(r, { ticks: 120, level: 0, ladder: [{ family: 'stun', count: 1, last: 10, end: 130 }] }, 'a landing now keeps the tick its CC ends');
  const steadfast = { immuneTier: 'steadfast', resist: 'stubborn' }, top = { immuneTier: 'unstoppable', resist: 'iron' };
  assert.deepEqual([35, 36, 41, 45, 46, 50].map((lv) => guardOfLevel(lv)), [undefined, steadfast, steadfast, steadfast, top, top], 'ranks 8-9 steadfast + stubborn, rank 10 unstoppable + iron, nothing below rank 8 (five levels a rank)');
  assert.equal(creature('c1', 'wolf', 0, 0).ccGuard, undefined, 'a rank-1 creature carries no guard');
  assert.deepEqual(creature('c2', 'wolf', 0, 0, 0, 46).ccGuard, top, 'a rank-10 creature carries its band\'s rows');
  const fields = DEFS.fields as readonly { id: string; of?: string; sim: boolean }[];
  assert.ok(fields.some((f) => f.id === 'immuneTier' && f.of === 'ccTiers' && f.sim) && fields.some((f) => f.id === 'resist' && f.of === 'ccResists' && f.sim), 'two sim ref fields (a catalogue row that names one wins over the band)');
});

test('CC timing row: post-CC immunity starts at the CC\'s END and lasts its ticks; a window counted from the end outlives one counted from the landing', () => {
  const withStun = (row: Partial<CcKind>) => ({ ...CC_LADDER, kinds: { ...CC_LADDER.kinds, stun: { ...CC_LADDER.kinds.stun!, ...row } } });
  const rows = withStun({ immunity: 60 });
  const first = ccApply(emptyLadder, 'postureBreak', 0, 120, rows);   // lands at 0, lasts to 120, immune to stuns until 180
  assert.deepEqual(first.ladder, [{ family: 'stun', count: 1, last: 0, end: 120 }]);
  assert.deepEqual(ccApply(first.ladder, 'parryStun', 150, 100, rows), { ticks: 0, level: 1, ladder: first.ladder }, 'inside the immunity: nothing, and the ladder is not refreshed');
  assert.equal(ccApply(first.ladder, 'parryStun', 180, 100, rows).ticks, 50, 'immunity over: the second step, half');
  assert.equal(ccApply(first.ladder, 'wallSlam', 150, 100, rows).ticks, 100, 'another family is untouched');
  const fromLand = withStun({ windowFrom: 'land' }), landed = ccApply(emptyLadder, 'postureBreak', 0, 120).ladder;
  assert.equal(ccApply(landed, 'parryStun', 1010, 100).ticks, 50, 'end 120 + window 900 = 1020: still on the ladder at 1010 (the shipped rows count from the end)');
  assert.equal(ccApply(landed, 'parryStun', 1010, 100, fromLand).ticks, 100, 'counted from the landing it would have reset by 1010');
});

test('immuneTier row: a creature on "steadfast" never takes a knockdown, in the engine too; a stun still lands', () => {
  const g: CcGuard = { immuneTier: 'steadfast' };
  assert.deepEqual(ccApply(emptyLadder, 'wallSlam', 5, 90, CC_LADDER, g), { ticks: 0, level: 0, ladder: emptyLadder });
  assert.equal(ccApply(emptyLadder, 'postureBreak', 5, 90, CC_LADDER, g).ticks, 90);
  assert.equal(breakOnce(emptyLadder, { immuneTier: 'unstoppable' }), null, 'stepDuel: an unstoppable target is never posture-stunned');
  assert.equal(breakOnce(emptyLadder), P.stun, 'the same cut on a target with no guard');
  assert.throws(() => ccApply(emptyLadder, 'wallSlam', 5, 90, CC_LADDER, { immuneTier: 'nope' }), /no immuneTier row nope/);
});

test('resist row: "iron" keeps half of what the ladder leaves, step by step, in the engine too', () => {
  const g: CcGuard = { resist: 'iron' }, a = ccApply(emptyLadder, 'postureBreak', 0, 120, CC_LADDER, g);
  assert.equal(a.ticks, 60); assert.equal(ccApply(a.ladder, 'parryStun', 200, 120, CC_LADDER, g).ticks, 30, 'the half step, then half of it (after the 120-tick post-CC immunity of the first)');
  assert.equal(breakOnce(emptyLadder, g), Math.round(P.stun / 2), 'stepDuel: the posture stun, halved');
  assert.throws(() => ccApply(emptyLadder, 'wallSlam', 5, 90, CC_LADDER, { resist: 'nope' }), /no resist row nope/);
});

test('swarm band row: each foe past the first widens the band by its rank\'s perFoe, up to the cap (shipped: +3 a foe, cap 6 for ranks 1-5, 9 for ranks 6-10)', () => {
  assert.deepEqual(SWARM_ROWS.map((r) => [r.rank, r.perFoe, r.cap]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => [rank, 3, rank <= 5 ? 6 : 9]));
  for (const rank of [1, 5, 10]) assert.equal(swarmBand(1, rank), ROLL_BAND, 'one foe widens nothing');
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => swarmBand(n, 3)), [10, 13, 16, 16, 16], 'ranks 1-5: +3 a foe, capped at +6');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => swarmBand(n, 8)), [10, 13, 16, 19, 19, 19], 'ranks 6-10: capped at +9');
  const rows = [{ id: 'only3', rank: 3, perFoe: 3, cap: 6 }];
  assert.equal(swarmBand(3, 4, rows), ROLL_BAND, 'a rank no row covers is untouched');
  const seen = new Set<number>(); for (let h = 0; h < 4000; h++) seen.add(percentOf(rollUnit(7, h), swarmBand(3, 3, rows)));
  assert.equal(Math.min(...seen), -16); assert.equal(Math.max(...seen), 16);
});

test('in the engine: a world duel with one foe rolls exactly as one carrying none; a swarm of three on rank 7 rolls a wider band', () => {
  const run = (roll: Duel['roll']) => { let d: Duel = { ...duel(), ...(roll ? { roll } : {}) }; const out: number[] = []; for (let i = 0; i < 400; i++) { d = stepDuel(d, [act('light'), act('light')]); out.push(d.fighters[0].health, d.fighters[1].health); } return out; };
  const seeded = withRoll(duel(), 99).roll!;
  assert.deepEqual(run({ ...seeded, swarm: 1, rank: 7 }), run(seeded));
  assert.notDeepEqual(run({ ...seeded, swarm: 3, rank: 7 }), run(seeded), 'the wider band changes the blows');
});

test('a new CC kind is ONE row (no code edit), and the loader refuses a broken row', () => {
  const kinds = Object.values(CC_LADDER.kinds), tiers = Object.values(CC_LADDER.tiers).map((t, i) => ({ id: Object.keys(CC_LADDER.tiers)[i]!, ...t })), resists = Object.entries(CC_LADDER.resists).map(([id, r]) => ({ id, ...r }));
  const stunKind = CC_LADDER.kinds.stun!, daze: CcKind = { id: 'daze', sources: ['gambitFail'], steps: [100, 0], window: 300, windowFrom: 'end', immunity: 30 };
  const rows = ccRows([...kinds.map((k) => (k.id === 'stun' ? { ...stunKind, sources: stunKind.sources.filter((s) => s !== 'gambitFail') } : k)), daze], tiers, resists);
  const first = ccApply(emptyLadder, 'gambitFail', 0, 90, rows);
  assert.deepEqual(first.ladder, [{ family: 'daze', count: 1, last: 0, end: 90 }], 'a gambit failure now steps the daze row');
  assert.equal(ccApply(first.ladder, 'gambitFail', 100, 90, rows).ticks, 0, 'its own steps: immune on the second');
  assert.throws(() => ccRows([...kinds, daze], tiers, resists), /source gambitFail is in kinds stun and daze/);
  assert.throws(() => ccRows([{ ...stunKind, steps: [50, 100] }], tiers, resists), /never rising/);
  assert.throws(() => ccRows(kinds, tiers, [{ id: 'x', keep: 140, from: 1, to: 1 }]), /keep is a percent/);
  assert.throws(() => ccRows(kinds, tiers, [{ id: 'a', keep: 50, from: 3, to: 5 }, { id: 'b', keep: 60, from: 5, to: 6 }]), /cover the same rank/);
  assert.throws(() => ccRows(kinds, [{ id: 'x', immune: ['stun'], from: 0, to: 2 }], resists), /inside 1..10/);
});
