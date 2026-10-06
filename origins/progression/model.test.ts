// Pins the ONE-career proposal (docs/specs/origins/progression-proposal.md): its constants, its three worked examples and the four
// properties ruling 7 asks for — existing players' level unchanged, credit monotonic, farm yield bounded per hour, boss ≈ arena win.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelOf as careerLevelOf } from '../../src/career.ts';
import {
  ARENA_WIN_CP, BOSS_CP, DAY_S, MAX_LEVEL, PER_KILL_CAP_CP, RESTED_CAP_CP, RESTED_PER_DAY_CP,
  award, creditFromMarks, falloffPermille, fillPermille, heatAt, levelOfCredit, newCareer, partyEligible, partySharePermille,
  repeatPermille, restedAvailable, settleAll, type CareerEvent, type CareerState, type MobClass,
} from './model.ts';
import { HOUR, MIN, botDay, farmGrey, farmLow, mobs, regionClear } from './scenarios.ts';

const mobCredit = (awards: { cp: number }[], events: CareerEvent[]): number =>
  awards.reduce((sum, a, i) => sum + (events[i].kind === 'mob' ? a.cp : 0), 0);

// A small deterministic generator for the property runs (no Math.random: failures must replay).
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('constants (the proposal table): one Pit win is one mark is one level; bosses pay exactly a win', () => {
  assert.equal(ARENA_WIN_CP, 1000);
  assert.equal(BOSS_CP, ARENA_WIN_CP);
  assert.equal(RESTED_PER_DAY_CP, 1500);
  assert.equal(RESTED_CAP_CP, 3000);
  assert.equal(PER_KILL_CAP_CP, 250);
});
test('constants (the proposal table): level-difference falloff bands', () => {
  const table = Object.fromEntries([5, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -15].map(d => [d, falloffPermille(d)]));
  assert.deepEqual(table, { 5: 1250, 3: 1250, 2: 1100, 1: 1100, 0: 1000, [-1]: 900, [-2]: 900, [-3]: 500, [-4]: 500, [-5]: 200, [-6]: 0, [-15]: 0 });
});
test('constants (the proposal table): party share (EverQuest group shape) and level-gap eligibility', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(partySharePermille), [1000, 800, 566, 450, 0]);
  assert.equal(partyEligible(20, 30), true); // gap 10 ≤ floor(20/2)
  assert.equal(partyEligible(19, 30), false); // gap 11 > 9
  assert.equal(partyEligible(5, 10), true); // gap 5 ≤ the floor of 5
  assert.equal(partyEligible(4, 10), false);
});
test('constants (the proposal table): repeat-kill multiplier: three free, then 3/(h+1)', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 9, 29, 59].map(repeatPermille), [1000, 1000, 1000, 750, 500, 300, 100, 50]);
});

test('existing players: the Pit ladder is untouched: migrated marks give the same level as src/career.ts for every count', () => {
  for (let m = 0; m <= 120; m++) assert.equal(levelOfCredit(creditFromMarks(m)), careerLevelOf(m));
  assert.equal(levelOfCredit(creditFromMarks(Number.NaN)), 1);
});
test('existing players: the Pit ladder is untouched: each Pit win is exactly one level, whatever the world state', () => {
  let s: CareerState = { ...newCareer(10), rested: 0, heat: { x: { units: 99_999, at: 0 } } };
  for (let w = 1; w <= 40; w++) {
    const a = award(s, { kind: 'arena-win', id: `pit-${w}`, at: w });
    assert.equal(a.cp, 1000);
    assert.equal(a.levelAfter, careerLevelOf(10 + w));
    s = a.state;
  }
  assert.equal(s.pitWins, 50);
});
test('existing players: the Pit ladder is untouched: Origin stays Origin; credit keeps counting and the bar shows no fill there', () => {
  const s = settleAll(newCareer(45), [{ kind: 'arena-win', id: 'p', at: 0 }]).state;
  assert.equal(levelOfCredit(s.credit), MAX_LEVEL);
  assert.equal(s.credit, 46_000);
  assert.equal(fillPermille(s.credit), 0);
  assert.equal(fillPermille(10_250), 250);
});

test('boss ≈ arena win: an even-level solo boss pays exactly one Pit win', () => {
  assert.equal(award(newCareer(15), { kind: 'boss', id: 'b', at: 0, boss: 'steward', bossLevel: 16, contributionPermille: 1000 }).cp, ARENA_WIN_CP);
});
test('boss ≈ arena win: never more than a win (no bonus above you); falls off below you exactly like mobs', () => {
  for (let d = -20; d <= 20; d++) {
    const cp = award(newCareer(19), { kind: 'boss', id: 'b', at: 0, boss: 'x', bossLevel: 20 + d, contributionPermille: 500 }).cp;
    assert.ok(cp <= ARENA_WIN_CP);
    assert.equal(cp, d >= 0 ? 1000 : falloffPermille(d));
  }
});
test('boss ≈ arena win: rolling 7-day lockout per boss; a grey kill does not start it', () => {
  const k = (id: string, at: number, bossLevel = 16): CareerEvent => ({ kind: 'boss', id, at, boss: 'count', bossLevel, contributionPermille: 400 });
  const r = settleAll(newCareer(15), [k('a', 0), k('b', 7 * DAY_S - 1), k('c', 7 * DAY_S)]);
  // The first kill made him level 17, so the same level-16 boss a week later is one below him: 900.
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[1000, 'ok'], [0, 'locked-out'], [900, 'ok']]);
  const g = settleAll(newCareer(30), [k('g', 0), k('h', 60)]);
  assert.deepEqual(g.awards.map(a => a.reason), ['grey', 'grey']);
  assert.deepEqual(g.state.bossAt, {});
});
test('boss ≈ arena win: needs a real share of the fight', () => {
  const e = (c: number): CareerEvent => ({ kind: 'boss', id: `c${c}`, at: 0, boss: 'b', bossLevel: 16, contributionPermille: c });
  assert.equal(award(newCareer(15), e(99)).reason, 'low-contribution');
  assert.equal(award(newCareer(15), e(100)).cp, 1000);
});

const regionEvents = regionClear();
const region = settleAll(newCareer(10), regionEvents);
const by = (pick: (e: CareerEvent) => boolean): number => region.awards.reduce((sum, a, i) => sum + (pick(regionEvents[i]) ? a.cp : 0), 0);
test('worked example A: a Gladiator I clears region 1 and chapter one: pins the evening', () => {
  assert.equal(by(e => e.kind === 'boss'), 3000);
  assert.equal(by(e => e.kind === 'story'), 900);
  assert.equal(by(e => e.kind === 'mob'), 2183);
  assert.equal(by(e => e.kind === 'mob' && e.mob === 'ash-hound'), 160);
  assert.equal(by(e => e.kind === 'mob' && e.mobClass === 'elite'), 1018);
  assert.equal(by(e => e.kind === 'mob' && e.mobClass === 'named'), 440);
  assert.equal(region.state.credit, 16_083);
  assert.equal(levelOfCredit(region.state.credit), 17); // Gladiator I → Veteran II
  assert.equal(restedAvailable(region.state, 155 * MIN), 977);
});
test('worked example A: a Gladiator I clears region 1 and chapter one: bosses and story are most of it; mobs are the smaller share', () => {
  assert.ok(by(e => e.kind === 'mob') < by(e => e.kind !== 'mob'));
});

const lvl30 = newCareer(29);
test('worked example B: a level-30 farming low creatures: B1: an hour on region-1 hounds (grey) pays nothing, but still heats the kind', () => {
  const r = settleAll(lvl30, farmGrey(0));
  assert.equal(r.state.credit - lvl30.credit, 0);
  assert.equal(r.awards.every(a => a.reason === 'grey'), true);
  assert.ok(heatAt(r.state, 'ash-hound', 120 * 30) > 0);
});
test('worked example B: a level-30 farming low creatures: B2: an hour on one level-25 kind pays 30 CP (3% of a Pit win)', () => {
  const r = settleAll(lvl30, farmLow(0));
  assert.equal(r.state.credit - lvl30.credit, 30);
  assert.deepEqual(r.awards.slice(0, 8).map(a => a.cp), [4, 4, 4, 4, 3, 2, 2, 1]);
});
test('worked example B: a level-30 farming low creatures: B3: a 24-hour bot on even-level mobs across 20 kinds: 3,937 CP, never above pool + refill in any hour', () => {
  const events = botDay(0);
  const r = settleAll(lvl30, events);
  assert.equal(r.state.credit - lvl30.credit, 3937);
  const hours = Array.from({ length: 24 }, (_, h) => r.awards.slice(h * 240, (h + 1) * 240).reduce((s, a) => s + a.cp, 0));
  assert.equal(hours[0], 3062);
  assert.ok(Math.max(...hours.slice(1)) <= 63);
});
test('worked example B: a level-30 farming low creatures: B4: the same bot for a week earns nothing more: every kind stays hot', () => {
  const r = settleAll(lvl30, botDay(0, 24 * 7));
  assert.equal(r.state.credit - lvl30.credit, 3937);
});

const party = [14, 15, 16, 20];
const share = [300, 250, 350, 100];
const others = (i: number, levels = party): number[] => levels.filter((_, j) => j !== i);
test('worked example C: a party of four kills a boss: everyone eligible gets their own Pit win; the over-level member gets the falloff', () => {
  const cps = party.map((lvl, i) =>
    award(newCareer(lvl - 1), { kind: 'boss', id: `count-${i}`, at: 0, boss: 'count', bossLevel: 16, partyLevels: others(i), contributionPermille: share[i] }).cp);
  assert.deepEqual(cps, [1000, 1000, 1000, 500]);
});
test('worked example C: a party of four kills a boss: an Origin carry earns nothing and makes the others ineligible', () => {
  const levels = [15, 16, 20, 46];
  const reasons = levels.map((lvl, i) =>
    award(newCareer(lvl - 1), { kind: 'boss', id: `c-${i}`, at: 0, boss: 'count', bossLevel: 16, partyLevels: others(i, levels), contributionPermille: 250 }).reason);
  assert.deepEqual(reasons, ['not-eligible', 'not-eligible', 'not-eligible', 'grey']);
});
test('worked example C: a party of four kills a boss: their elite kills split EverQuest-style and take the highest member\'s colour', () => {
  const elite = (lvl: number, partyLevels: number[]): number =>
    award(newCareer(lvl - 1), { kind: 'mob', id: 'e', at: 0, mob: 'court-sentinel', mobClass: 'elite', mobLevel: 15, partyLevels }).cp;
  assert.equal(elite(15, [14, 16, 20]), 7); // 80 × 0.2 (grey-ish for the level 20) × 0.45
  assert.equal(elite(15, [14, 16]), 40); // 80 × 0.9 × 0.566
  assert.equal(elite(15, []), 80);
});

function randomStream(seed: number, n: number): CareerEvent[] {
  const rnd = lcg(seed);
  const out: CareerEvent[] = [];
  let t = 0;
  const classes: MobClass[] = ['ordinary', 'elite', 'named'];
  for (let i = 0; i < n; i++) {
    t += Math.floor(rnd() * 600) - 30; // occasionally out of order
    const pick = rnd();
    const id = rnd() < 0.05 && i > 0 ? out[Math.floor(rnd() * out.length)].id : `e${i}`; // retries
    if (pick < 0.1) out.push({ kind: 'arena-win', id, at: t });
    else if (pick < 0.2) out.push({ kind: 'boss', id, at: t, boss: `b${Math.floor(rnd() * 5)}`, bossLevel: 11 + Math.floor(rnd() * 36), contributionPermille: Math.floor(rnd() * 400) });
    else if (pick < 0.25) out.push({ kind: 'story', id, at: t, step: `s${Math.floor(rnd() * 20)}`, cp: Math.floor(rnd() * 1200) });
    else out.push({ kind: 'mob', id, at: t, mob: `m${Math.floor(rnd() * 12)}`, mobClass: classes[Math.floor(rnd() * 3)], mobLevel: 11 + Math.floor(rnd() * 36), partyLevels: rnd() < 0.3 ? [11 + Math.floor(rnd() * 36)] : undefined });
  }
  return out;
}
test('properties: credit and level never go down, and no award is negative (random streams with retries and late events)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = settleAll(newCareer(10 + seed), randomStream(seed, 1500));
    let credit = creditFromMarks(10 + seed);
    for (const a of r.awards) {
      assert.ok(a.cp >= 0);
      assert.ok(a.state.credit >= credit);
      assert.ok(a.levelAfter >= a.levelBefore);
      credit = a.state.credit;
    }
  }
});
test('properties: a retried event id pays once', () => {
  const e: CareerEvent = { kind: 'arena-win', id: 'fight-hash-1', at: 0 };
  const settled = new Set<string>();
  const first = settleAll(newCareer(12), [e], settled);
  const again = settleAll(first.state, [e, e], settled);
  assert.deepEqual(again.awards.map(a => a.reason), ['duplicate', 'duplicate']);
  assert.equal(again.state.credit, 13_000);
});
test('properties: bounded farm yield: mob credit in any span ≤ the pool at its start + the refill over it', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = lcg(seed * 7919);
    const level = 11 + Math.floor(rnd() * 30);
    const start = newCareer(level - 1);
    const kinds = 1 + Math.floor(rnd() * 50);
    const events: CareerEvent[] = [];
    let t = 0;
    while (t < 24 * HOUR) {
      t += 5 + Math.floor(rnd() * 60);
      const cls: MobClass = rnd() < 0.8 ? 'ordinary' : rnd() < 0.8 ? 'elite' : 'named';
      events.push({ kind: 'mob', id: `f${seed}-${t}`, at: t, mob: `k${Math.floor(rnd() * kinds)}`, mobClass: cls, mobLevel: level + Math.floor(rnd() * 5) - 1 });
    }
    const r = settleAll(start, events);
    for (const span of [HOUR, 6 * HOUR, 24 * HOUR]) {
      for (let from = 0; from + span <= 24 * HOUR; from += HOUR) {
        const inSpan = r.awards.filter((_, i) => events[i].at > from && events[i].at <= from + span);
        const earned = inSpan.reduce((s, a) => s + a.cp, 0);
        const before = r.awards.findIndex((_, i) => events[i].at > from);
        const pool = before <= 0 ? RESTED_CAP_CP : restedAvailable(r.awards[before - 1].state, from);
        assert.ok(earned <= pool + Math.ceil((span * RESTED_PER_DAY_CP) / DAY_S));
      }
    }
    assert.ok(mobCredit(r.awards, events) <= RESTED_CAP_CP + RESTED_PER_DAY_CP);
  }
});
test('properties: an empty pool pays nothing for mobs until it refills; Pit wins and bosses ignore it', () => {
  const dry: CareerState = { ...newCareer(14), rested: 0, restedAt: 0 };
  const kill = (id: string, at: number): CareerEvent => ({ kind: 'mob', id, at, mob: `k-${id}`, mobClass: 'ordinary', mobLevel: 15 });
  assert.equal(award(dry, kill('a', 0)).reason, 'rested-out');
  assert.equal(restedAvailable(dry, 12 * HOUR), 750);
  assert.equal(award(dry, kill('b', 12 * HOUR)).cp, 20); // even level
  assert.equal(award(dry, { kind: 'arena-win', id: 'p', at: 0 }).cp, 1000);
  assert.equal(award(dry, { kind: 'boss', id: 'x', at: 0, boss: 'x', bossLevel: 15, contributionPermille: 200 }).cp, 1000);
});
test('properties: a late event never rewinds the clocks (no free refill from clock skew)', () => {
  const s = settleAll({ ...newCareer(14), rested: 0, restedAt: 0 }, mobs(HOUR, 1, 1, 'k', 'ordinary', 15)).state;
  const late = award(s, { kind: 'mob', id: 'late', at: 0, mob: 'k2', mobClass: 'ordinary', mobLevel: 15 });
  assert.equal(late.cp, 20);
  assert.equal(late.state.restedAt, HOUR);
  assert.equal(restedAvailable(late.state, HOUR), restedAvailable(s, HOUR) - late.cp); // no refill was invented
});
test('properties: story steps pay once, and never more than one mark', () => {
  const r = settleAll(newCareer(10), [
    { kind: 'story', id: 'a', at: 0, step: 'ch1', cp: 500 },
    { kind: 'story', id: 'b', at: 1, step: 'ch1', cp: 500 },
    { kind: 'story', id: 'c', at: 2, step: 'ch2', cp: 1001 },
  ]);
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[500, 'ok'], [0, 'already-done'], [0, 'bad-event']]);
});
test('properties: a party larger than four is refused', () => {
  assert.equal(award(newCareer(14), { kind: 'mob', id: 'p5', at: 0, mob: 'm', mobClass: 'ordinary', mobLevel: 15, partyLevels: [15, 15, 15, 15] }).reason, 'bad-event');
});
