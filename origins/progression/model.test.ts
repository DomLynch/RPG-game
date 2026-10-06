// Pins the ONE-career proposal (docs/specs/origins/progression-proposal.md): the rising requirement curve, the universal pay rule
// (kill value × falloff × type weight), first-win-only bosses reopened at the top, its worked examples and the properties ruling 7
// asks for — existing players' level unchanged, credit monotonic, farm yield bounded, no NaN.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_LEVEL as careerMaxLevel, levelOf as careerLevelOf } from '../../src/career.ts';
import { LEGEND_OPPONENTS, rungOf } from '../../src/legends.ts';
import {
  DAY_S, HEAT_UNIT_S, MAX_LEVEL, RESTED_CAP_CP, RESTED_PER_DAY_CP, TYPE_WEIGHTS,
  allBossesOpen, award, basePay, weightAt, creditFromMarks, cumulative, falloffPermille, fillPermille, heatAt, heatKills, killValue, legendKey,
  levelOfCredit, levelOfMarks, newCareer, nextLegend, partyEligible, partySharePermille, repeatPermille, requirement, restedAvailable,
  settleAll, tierOf, type CareerEvent, type CareerState, type TypeTable,
} from './model.ts';
import { CASUAL, HEAVY, HOUR, MIN, boss, botDay, farmGrey, farmLow, mobs, playerDays, regionClear } from './scenarios.ts';

const OPP = LEGEND_OPPONENTS; // today's Pit: the ten opponents (content, read only by the scenarios, never by the pay)
const win = (id: string, at: number, opponent = 'veteran'): CareerEvent => ({ kind: 'arena-win', id, at, opponent });
const kill = (id: string, type: string, target: string, targetLevel: number, extra: Partial<CareerEvent> = {}): CareerEvent =>
  ({ kind: 'kill', id, at: 0, type, target, targetLevel, contributionPermille: 1000, ...extra } as CareerEvent);
const story = (id: string, at: number, step: string, chapter = false): CareerEvent =>
  ({ kind: 'story', id, at, step, type: chapter ? 'story-chapter' : 'story-step' });

// A small deterministic generator for the property runs (no Math.random: failures must replay).
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The curve.

test('curve: the key rows of the proposal table (requirement to the next level, cumulative to reach it)', () => {
  const rows = [1, 10, 11, 21, 31, 41, 45, 46, 50].map(l => [l, requirement(l), cumulative(l)]);
  assert.deepEqual(rows, [
    [1, 1000, 0], [10, 1900, 12_600], [11, 2025, 14_500], [21, 6025, 48_625], [31, 15_025, 145_250],
    [41, 29_025, 354_375], [45, 36_025, 480_725], [46, 37_900, 516_750], [50, 45_900, 680_100],
  ]);
});
test('curve: integer, rising every level, gentle to level 10 and steeper from Gladiator I (level 11)', () => {
  for (let l = 1; l <= 60; l++) {
    assert.ok(Number.isSafeInteger(requirement(l)) && Number.isSafeInteger(cumulative(l)));
    assert.ok(requirement(l + 1) > requirement(l));
    const second = requirement(l + 2) - 2 * requirement(l + 1) + requirement(l); // the curvature
    assert.equal(second, l < 9 ? 0 : l === 9 ? 25 : 50, `curvature at ${l}`); // flat to 10, curving from 11
  }
});
test('curve: cumulative is the sum of the requirements (closed form checked against a loop)', () => {
  let sum = 0;
  for (let l = 1; l <= 80; l++) {
    assert.equal(cumulative(l), sum, `level ${l}`);
    sum += requirement(l);
  }
});
test('curve: levelOfCredit reads the curve exactly at every boundary, at caps 46 and 50, and never above the cap', () => {
  for (const cap of [46, 50]) {
    for (let l = 2; l <= cap; l++) {
      assert.equal(levelOfCredit(cumulative(l) - 1, cap), l - 1);
      assert.equal(levelOfCredit(cumulative(l), cap), l);
    }
    assert.equal(levelOfCredit(1e12, cap), cap);
  }
  for (const bad of [Number.NaN, -5, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) assert.equal(levelOfCredit(bad), 1);
});
test('curve: the rank bar fills by the part of the current level earned; empty at the top', () => {
  assert.equal(fillPermille(cumulative(20) + requirement(20) / 2), 500);
  assert.equal(fillPermille(cumulative(20)), 0);
  for (const cap of [46, 50]) assert.equal(fillPermille(cumulative(cap) + 12_345, cap), 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// What drives rank, and the migration.

test('what drives rank: levelOfCredit(creditFromMarks(m)) is today\'s levelOf(m) for marks 0..120, at cap 46 and at cap 50', () => {
  for (let m = 0; m <= 120; m++) {
    assert.equal(levelOfMarks(m), careerLevelOf(m));
    assert.equal(levelOfCredit(creditFromMarks(m)), careerLevelOf(m), `default cap, ${m} marks`);
    assert.equal(levelOfCredit(creditFromMarks(m, 46), 46), careerLevelOf(m), `cap 46, ${m} marks`);
    // src/career.ts levelOf is min(MAX_LEVEL, 1 + wins); at cap 50 that same rule reads min(50, 1 + m).
    assert.equal(levelOfCredit(creditFromMarks(m, 50), 50), Math.min(50, 1 + m), `cap 50, ${m} marks`);
  }
  assert.equal(levelOfCredit(creditFromMarks(Number.NaN)), 1);
});
test('migration: a live account resumes the Pit at its own level with nothing beaten, and keeps its win count for the board', () => {
  const s = newCareer(23);
  assert.deepEqual([s.credit, s.pit.rung, s.beaten.length, s.pitWins], [cumulative(24), 24, 0, 23]);
});
test('ladder cap: the model reads src/career.ts MAX_LEVEL and declares no cap of its own', () => {
  assert.equal(MAX_LEVEL, careerMaxLevel);
  assert.equal(levelOfCredit(1e12), careerMaxLevel);
});
test('titles: tierOf is the legend rung src/legends.ts already shows for every level', () => {
  for (let l = 1; l <= careerMaxLevel; l++) assert.equal(tierOf(l), rungOf(l), `level ${l}`);
  assert.deepEqual([45, 46, 50].map(tierOf), [9, 10, 10]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The universal pay rule and the type-weight table.

test('type weights: the table (permille of the kill value), and the flags that decide once / rested / party', () => {
  const table = Object.fromEntries(Object.entries(TYPE_WEIGHTS).map(([k, r]) => [k, [r.weight, r.once, r.rested, r.party]]));
  assert.deepEqual(table, {
    legend: [100, true, false, 'solo'], 'world-boss': [500, true, false, 'each'], named: [200, false, true, 'split'],
    elite: [80, false, true, 'split'], mob: [20, false, true, 'split'], 'story-step': [100, true, false, 'solo'],
    'story-chapter': [500, true, false, 'solo'],
  });
});
test('kill value: the curve\'s linear part — equal to the requirement to level 10, behind it every level from Gladiator I', () => {
  for (let l = 1; l <= 10; l++) assert.equal(killValue(l), requirement(l));
  for (let l = 11; l <= 60; l++) assert.ok(killValue(l) < requirement(l));
  assert.deepEqual([11, 30, 49].map(killValue), [2000, 3900, 5800]);
});
test('one pay rule: every row pays killValue(min(target, you)) × falloff × weight, at every level 1..50 and d −12..+12', () => {
  for (let you = 1; you <= 50; you++) {
    for (let d = -12; d <= 12; d++) {
      if (you + d < 1) continue;
      for (const [type, row] of Object.entries(TYPE_WEIGHTS)) {
        if (row.atOwn) continue;
        const a = award(newCareer(you - 1, 0, 50), kill('k', type, 'x', you + d), 50);
        const want = Math.floor((killValue(Math.min(you + d, you)) * falloffPermille(d) * weightAt(row, Math.min(you + d, you))) / 1e6);
        assert.equal(a.cp, want, `${type} at level ${you}, d ${d}`);
      }
    }
  }
});
test('shares shrink from Gladiator I: each row\'s even-level pay is a fixed part of a level to 10 and a smaller part every level from 11', () => {
  for (const [type, row] of Object.entries(TYPE_WEIGHTS)) {
    for (let l = 1; l <= 10; l++) assert.equal((basePay(row, l, l) * 1000) / requirement(l), weightAt(row, l), `${type} at ${l}`);
    for (let l = 10; l < 50; l++) {
      assert.ok(basePay(row, l + 1, l + 1) * requirement(l) < basePay(row, l, l) * requirement(l + 1), `${type}: share at ${l + 1} not below ${l}`);
    }
  }
});
test('a new content type plugs in with ONE row and no curve change: a minotaur, first kill only', () => {
  const curveBefore = [1, 11, 30, 50].map(l => [requirement(l), cumulative(l), killValue(l)]);
  const types: TypeTable = { ...TYPE_WEIGHTS, minotaur: { weight: 300, once: true, rested: false, party: 'each' } };
  const r = settleAll(newCareer(19), [kill('m1', 'minotaur', 'labyrinth-bull', 20), kill('m2', 'minotaur', 'labyrinth-bull', 20)], new Set(), MAX_LEVEL, types);
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[Math.floor((killValue(20) * 300) / 1000), 'ok'], [0, 'already-beaten']]);
  assert.equal(r.awards[0].cp, 870);
  assert.deepEqual(r.state.beaten, ['minotaur:labyrinth-bull']);
  assert.equal(award(newCareer(19), kill('m3', 'minotaur', 'labyrinth-bull', 20)).reason, 'bad-event'); // not in the shipped table
  assert.deepEqual([1, 11, 30, 50].map(l => [requirement(l), cumulative(l), killValue(l)]), curveBefore);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The Pit.

test('Pit: a legend pays a fifth of a level to L10 and a tenth from Gladiator I (Dom 2026-10-06), its first win only; a second win pays 0', () => {
  const r = settleAll(newCareer(4), [win('a', 0, 'goblin'), win('b', 1, 'goblin'), win('c', 2, 'knight')]);
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[280, 'ok'], [0, 'already-beaten'], [280, 'ok']]);
  assert.equal(280 * 5, requirement(5));
  assert.deepEqual([basePay(TYPE_WEIGHTS.legend, 10, 10) * 5, basePay(TYPE_WEIGHTS.legend, 11, 11)], [requirement(10), 200]); // the taper at Gladiator I
  assert.deepEqual(r.state.beaten, [legendKey('goblin', 5), legendKey('knight', 5)]);
  assert.equal(r.state.pitWins, 6); // 4 migrated + 2 paid wins
});
test('Pit alone: levels 1 to 10 are reachable on the Pit alone — five first wins at each level pay exactly that level', () => {
  let s = newCareer(0);
  for (let level = 1; level <= 10; level++) {
    let w = 0;
    while (levelOfCredit(s.credit) === level) {
      const opponent = nextLegend(s, OPP, w * 31 + level);
      assert.ok(opponent !== null);
      s = award(s, win(`w${level}-${w}`, 0, opponent)).state;
      w++;
    }
    assert.deepEqual([w, levelOfCredit(s.credit), s.credit], [5, level + 1, cumulative(level + 1)], `after level ${level}`);
  }
});
test('Pit alone stalls at Gladiator I, below Origin V at caps 46 and 50: it falls out of the weights, there is no cap on the Pit', () => {
  for (const cap of [46, 50]) {
    let s = newCareer(0, 0, cap);
    let wins = 0;
    for (let opponent = nextLegend(s, OPP, 0, cap); opponent !== null; opponent = nextLegend(s, OPP, wins * 7919, cap)) {
      s = award(s, win(`w${wins}`, wins, opponent), cap).state;
      wins++;
    }
    // Ten legends at level 11 pay 10 × 200 = 2,000 of the 2,025 that level needs: the Pit has paid all it has at your level.
    assert.deepEqual([wins, s.credit, levelOfCredit(s.credit, cap)], [60, cumulative(11) + 2000, 11]); // 5 a level to L10, then all ten at L11
    assert.ok(levelOfCredit(s.credit, cap) < cap);
    // A sliver of world credit and the Pit opens again at level 12.
    const w = award(s, story('st', 0, 'any/1'), cap).state;
    assert.equal(levelOfCredit(w.credit, cap), 12);
    assert.ok(nextLegend(w, OPP, 1, cap) !== null);
  }
});
test('Pit: the next opponent is never one already beaten at your level; null when all are', () => {
  const rnd = lcg(11);
  for (let i = 0; i < 300; i++) {
    const level = 1 + Math.floor(rnd() * 45);
    const s: CareerState = { ...newCareer(level - 1), beaten: OPP.filter(() => rnd() < 0.5).map(o => legendKey(o, level)) };
    const pick = nextLegend(s, OPP, Math.floor(rnd() * 2 ** 32));
    if (s.beaten.length === OPP.length) assert.equal(pick, null);
    else assert.ok(pick !== null && !s.beaten.includes(legendKey(pick, level)));
  }
});
test('Pit: an empty or malformed opponent is refused', () => {
  for (const opponent of ['', 'a@3', 7 as unknown as string]) assert.equal(award(newCareer(5), win('x', 0, opponent)).reason, 'bad-event');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Bosses: first win only; the top reopens them.

test('world boss: the first kill pays half a kill value at even level; the second kill of the same boss pays 0 (already-beaten)', () => {
  const r = settleAll(newCareer(29), [kill('a', 'world-boss', 'steward', 30), kill('b', 'world-boss', 'steward', 30)]);
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[1950, 'ok'], [0, 'already-beaten']]);
  assert.deepEqual(r.state.beaten, ['world-boss:steward']);
});
test('world boss: a grey kill and a low share pay 0 and do not use the boss up; ≥ 10% of the fight is needed', () => {
  assert.deepEqual(settleAll(newCareer(30), [kill('g', 'world-boss', 'count', 16)]).state.beaten, []);
  assert.equal(award(newCareer(15), kill('c', 'world-boss', 'b', 16, { contributionPermille: 99 })).reason, 'low-contribution');
  assert.equal(award(newCareer(15), kill('c', 'world-boss', 'b', 16, { contributionPermille: 100 })).cp, Math.floor((killValue(16) * 500) / 1000));
});
test('Origin V reopens every boss: reaching the cap clears the beaten flags, and while there none is kept', () => {
  for (const cap of [46, 50]) {
    const near: CareerState = { ...newCareer(cap - 2, 0, cap), credit: cumulative(cap) - 1, beaten: ['world-boss:steward', legendKey('goblin', cap - 1)] };
    assert.equal(allBossesOpen(levelOfCredit(near.credit, cap), cap), false);
    assert.equal(award(near, kill('x', 'world-boss', 'steward', cap - 1), cap).reason, 'already-beaten');
    const top = award(near, kill('y', 'world-boss', 'warden', cap - 1), cap);
    assert.deepEqual([top.levelAfter, top.state.beaten, allBossesOpen(top.levelAfter, cap)], [cap, [], true]);
    const again = award(top.state, kill('z', 'world-boss', 'steward', cap), cap); // the re-fight is open; the level cannot move
    assert.deepEqual([again.reason, again.levelAfter, again.state.beaten], ['ok', cap, []]);
    assert.ok(nextLegend(again.state, OPP, 3, cap) !== null);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The other tables.

test('constants (the proposal table): rested allowance stays fixed in CP', () => {
  assert.equal(RESTED_PER_DAY_CP, 1500);
  assert.equal(RESTED_CAP_CP, 3000);
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
  assert.equal(partyEligible(34, 50), true); // gap 16 ≤ 17
  assert.equal(partyEligible(33, 50), false); // gap 17 > 16
});
test('constants (the proposal table): repeat-kill multiplier: three free, then 3/(h+1)', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 9, 29, 59].map(repeatPermille), [1000, 1000, 1000, 750, 500, 300, 100, 50]);
});
test('repeat heat rounds UP: three kills in a row pay in full and the fourth is reduced whenever kills come close together', () => {
  assert.deepEqual([0, 1, 359, 360, 361, 719, 720, 721].map(heatKills), [0, 1, 1, 1, 2, 2, 2, 3]);
  // The rule in one line: four kills of one kind inside six minutes (gaps under 120 s), and the fourth is reduced. Level 15, even mob: 48.
  for (const gap of [1, 30, 75, 119]) {
    const r = settleAll(newCareer(14), mobs(0, gap, 4, `kind-${gap}`, 'mob', 15));
    assert.deepEqual(r.awards.map(a => a.cp), [48, 48, 48, 36], `kills ${gap} s apart`);
  }
  for (const gap of [120, 179]) {
    const r = settleAll(newCareer(14), mobs(0, gap, 4, `kind-${gap}`, 'mob', 15));
    assert.deepEqual(r.awards.map(a => a.cp), [48, 48, 48, 48], `kills ${gap} s apart`);
  }
  assert.deepEqual(settleAll(newCareer(14), mobs(0, HEAT_UNIT_S, 6, 'slow', 'mob', 15)).awards.map(a => a.cp), [48, 48, 48, 48, 48, 48]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Worked examples.

const regionEvents = regionClear();
const region = settleAll(newCareer(10), regionEvents);
const by = (pick: (e: CareerEvent) => boolean): number => region.awards.reduce((sum, a, i) => sum + (pick(regionEvents[i]) ? a.cp : 0), 0);
const isType = (t: string) => (e: CareerEvent): boolean => e.kind === 'kill' && e.type === t;
test('worked example A: a Gladiator I clears region 1 and chapter one: pins the evening', () => {
  assert.equal(newCareer(10).credit, 14_500);
  assert.deepEqual(region.awards.filter((_, i) => isType('world-boss')(regionEvents[i])).map(a => a.cp), [1100, 1312, 1375]);
  assert.equal(by(isType('world-boss')), 3787);
  assert.equal(by(e => e.kind === 'story'), 1980);
  assert.equal(by(isType('mob')), 1361);
  assert.equal(by(e => e.kind === 'kill' && e.target === 'ash-hound'), 288);
  assert.equal(by(isType('elite')), 1757);
  assert.equal(by(isType('named')), 16); // the allowance ran dry before the named kills
  assert.equal(region.state.credit, 23_401);
  assert.equal(levelOfCredit(region.state.credit), 14); // Gladiator I → Gladiator IV
  assert.equal(restedAvailable(region.state, 155 * MIN), 26);
  assert.equal(region.state.pit.rung, 11); // the Pit waits at Gladiator I
});

const lvl30 = newCareer(29);
test('worked example B: a level-30 farming low creatures: B1: an hour on region-1 hounds (grey) pays nothing, but still heats the kind', () => {
  const r = settleAll(lvl30, farmGrey(0));
  assert.equal(r.state.credit - lvl30.credit, 0);
  assert.equal(r.awards.every(a => a.reason === 'grey'), true);
  assert.ok(heatAt(r.state, 'ash-hound', 120 * 30) > 0);
});
test('worked example B: B2: an hour on one level-25 kind pays 121 CP, under 1% of a level at 30', () => {
  const r = settleAll(lvl30, farmLow(0));
  assert.equal(r.state.credit - lvl30.credit, 121);
  assert.deepEqual(r.awards.slice(0, 8).map(a => a.cp), [13, 13, 13, 9, 7, 6, 5, 4]);
  assert.equal(requirement(30), 13_900);
});
test('worked example B: B3: a 24-hour bot on even-level mobs across 20 kinds: 4,499 CP (a third of a level at 30), never above pool + refill in any hour', () => {
  const r = settleAll(lvl30, botDay(0));
  assert.equal(r.state.credit - lvl30.credit, 4499);
  const hours = Array.from({ length: 24 }, (_, h) => r.awards.slice(h * 240, (h + 1) * 240).reduce((s, a) => s + a.cp, 0));
  assert.equal(hours[0], 3062);
  assert.ok(Math.max(...hours.slice(1)) <= 63);
  assert.equal(levelOfCredit(r.state.credit), 30);
});
test('worked example B: B4: the same bot for a week earns 10,161 CP: the allowance is the ceiling, under one level at 30', () => {
  const r = settleAll(lvl30, botDay(0, 24 * 7));
  assert.equal(r.state.credit - lvl30.credit, 10_161);
  assert.ok(r.state.credit - lvl30.credit <= RESTED_CAP_CP + 7 * RESTED_PER_DAY_CP);
  assert.equal(levelOfCredit(r.state.credit), 30);
});

const party = [14, 15, 16, 20];
const share = [300, 250, 350, 100];
const others = (i: number, levels = party): number[] => levels.filter((_, j) => j !== i);
test('worked example C: a party of four kills a boss: each eligible member gets their own award; the over-level member gets the falloff', () => {
  const cps = party.map((lvl, i) => award(newCareer(lvl - 1), boss(`count-${i}`, 0, 'count', 16, share[i], others(i))).cp);
  assert.deepEqual(cps, [1265, 1320, 1250, 625]);
});
test('worked example C: an Origin carry earns nothing and makes the others ineligible', () => {
  const levels = [15, 16, 20, 46];
  const reasons = levels.map((lvl, i) => award(newCareer(lvl - 1), boss(`c-${i}`, 0, 'count', 16, 250, others(i, levels))).reason);
  assert.deepEqual(reasons, ['not-eligible', 'not-eligible', 'not-eligible', 'grey']);
});
test('worked example C: their elite kills split EverQuest-style and take the highest member\'s colour', () => {
  const elite = (lvl: number, partyLevels: number[]): number =>
    award(newCareer(lvl - 1), { kind: 'kill', id: 'e', at: 0, type: 'elite', target: 'court-sentinel', targetLevel: 15, partyLevels }).cp;
  assert.equal(elite(15, [14, 16, 20]), 17); // the level 20's colour (×0.2), his value, ×0.45
  assert.equal(elite(15, [14, 16]), 97); // the level 16's colour (×0.9), ×0.566
  assert.equal(elite(15, []), 192);
});

test('worked example D: days to Gladiator I and to Origin, casual (30 min) and heavy (3 h), at cap 46 and 50', () => {
  const titles = [6, 11, 16, 21, 26, 31, 36, 41, 46];
  const runs = [[CASUAL, [8, 17, 22, 31, 44, 62, 88, 125, 177], 231], [HEAVY, [2, 4, 5, 7, 10, 15, 23, 35, 52], 70]] as const;
  for (const [p, days, origin5] of runs) {
    const run = playerDays(p, OPP, 3000);
    assert.deepEqual(titles.map(l => run.dayReached[l]), days, p.name);
    const at50 = playerDays(p, OPP, 3000, 50);
    assert.equal(at50.dayReached[50], origin5, `${p.name}: Origin V at cap 50`);
    // The Pit's share falls out of the weights: all of a level to Gladiator I, a fifth or so of the climb from there to Origin V.
    let pit = 0;
    let all = 0;
    for (let l = 11; l < 50; l++) {
      const x = at50.byLevel[l];
      pit += x.pit;
      all += x.pit + x.boss + x.mob + x.story;
    }
    assert.ok(pit * 4 < all && pit * 6 > all, `${p.name}: Pit ${pit} of ${all} from 11`);
    for (let l = 1; l < 11; l++) assert.equal(at50.byLevel[l].boss + at50.byLevel[l].mob + at50.byLevel[l].story, 0);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Properties.

function randomStream(seed: number, n: number): CareerEvent[] {
  const rnd = lcg(seed);
  const out: CareerEvent[] = [];
  let t = 0;
  const types = ['mob', 'elite', 'named', 'world-boss'];
  for (let i = 0; i < n; i++) {
    t += Math.floor(rnd() * 600) - 30; // occasionally out of order
    const pick = rnd();
    const id = rnd() < 0.05 && i > 0 ? out[Math.floor(rnd() * out.length)].id : `e${i}`; // retries
    if (pick < 0.1) out.push({ kind: 'arena-win', id, at: t, opponent: OPP[Math.floor(rnd() * OPP.length)] });
    else if (pick < 0.15) out.push({ kind: 'story', id, at: t, step: `s${Math.floor(rnd() * 20)}`, type: rnd() < 0.8 ? 'story-step' : 'story-chapter' });
    else {
      const type = types[Math.floor(rnd() * types.length)];
      out.push({
        kind: 'kill', id, at: t, type, target: `${type}${Math.floor(rnd() * 12)}`, targetLevel: 11 + Math.floor(rnd() * 36),
        contributionPermille: Math.floor(rnd() * 400), partyLevels: rnd() < 0.3 ? [11 + Math.floor(rnd() * 36)] : undefined,
      });
    }
  }
  return out;
}
test('properties: credit and level never go down, no award is negative, the Pit rung is never above the level, nothing paid twice (random streams)', () => {
  for (const cap of [46, 50]) {
    for (let seed = 1; seed <= 20; seed++) {
      const r = settleAll(newCareer(10 + seed, 0, cap), randomStream(seed, 1500), new Set(), cap);
      let credit = creditFromMarks(10 + seed, cap);
      for (const a of r.awards) {
        assert.ok(Number.isSafeInteger(a.cp) && a.cp >= 0);
        assert.ok(a.state.credit >= credit);
        assert.ok(a.levelAfter >= a.levelBefore);
        assert.ok(a.levelAfter >= a.state.pit.rung, `level ${a.levelAfter} below rung ${a.state.pit.rung}`);
        assert.equal(new Set(a.state.beaten).size, a.state.beaten.length); // no boss beaten twice
        if (a.levelAfter === cap) assert.deepEqual(a.state.beaten, []);
        credit = a.state.credit;
      }
    }
  }
});
test('properties: a retried event id pays once', () => {
  const e = win('fight-hash-1', 0);
  const settled = new Set<string>();
  const first = settleAll(newCareer(12), [e], settled);
  const again = settleAll(first.state, [e, e], settled);
  assert.deepEqual(again.awards.map(a => a.reason), ['duplicate', 'duplicate']);
  assert.equal(again.state.credit, cumulative(13) + basePay(TYPE_WEIGHTS.legend, 13, 13));
});
test('properties: bounded farm yield: creature credit in any span ≤ the pool at its start + the refill over it', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = lcg(seed * 7919);
    const level = 11 + Math.floor(rnd() * 30);
    const start = newCareer(level - 1);
    const kinds = 1 + Math.floor(rnd() * 50);
    const events: CareerEvent[] = [];
    let t = 0;
    while (t < 24 * HOUR) {
      t += 5 + Math.floor(rnd() * 60);
      const type = rnd() < 0.8 ? 'mob' : rnd() < 0.8 ? 'elite' : 'named';
      events.push({ kind: 'kill', id: `f${seed}-${t}`, at: t, type, target: `k${Math.floor(rnd() * kinds)}`, targetLevel: level + Math.floor(rnd() * 5) - 1 });
    }
    const r = settleAll(start, events);
    for (const span of [HOUR, 6 * HOUR, 24 * HOUR]) {
      for (let from = 0; from + span <= 24 * HOUR; from += HOUR) {
        const earned = r.awards.filter((_, i) => events[i].at > from && events[i].at <= from + span).reduce((s, a) => s + a.cp, 0);
        const before = r.awards.findIndex((_, i) => events[i].at > from);
        const pool = before <= 0 ? RESTED_CAP_CP : restedAvailable(r.awards[before - 1].state, from);
        assert.ok(earned <= pool + Math.ceil((span * RESTED_PER_DAY_CP) / DAY_S));
      }
    }
    assert.ok(r.state.credit - start.credit <= RESTED_CAP_CP + RESTED_PER_DAY_CP);
  }
});
test('properties: an empty pool pays nothing for creatures until it refills; Pit wins and bosses ignore it', () => {
  const dry: CareerState = { ...newCareer(14), rested: 0, restedAt: 0 };
  const creature = (id: string, at: number): CareerEvent => ({ kind: 'kill', id, at, type: 'mob', target: `k-${id}`, targetLevel: 15 });
  assert.equal(award(dry, creature('a', 0)).reason, 'rested-out');
  assert.equal(restedAvailable(dry, 12 * HOUR), 750);
  assert.equal(award(dry, creature('b', 12 * HOUR)).cp, 48); // even level
  assert.equal(award(dry, win('p', 0)).cp, 240);
  assert.equal(award(dry, kill('x', 'world-boss', 'x', 15, { contributionPermille: 200 })).cp, 1200);
});
test('properties: a late event never rewinds the clocks (no free refill from clock skew)', () => {
  const s = settleAll({ ...newCareer(14), rested: 0, restedAt: 0 }, mobs(HOUR, 1, 1, 'k', 'mob', 15)).state;
  const late = award(s, { kind: 'kill', id: 'late', at: 0, type: 'mob', target: 'k2', targetLevel: 15 });
  assert.equal(late.cp, 14); // the 62 CP refilled by HOUR, less the 48 already paid: nothing extra for arriving late
  assert.equal(late.state.restedAt, HOUR);
  assert.equal(restedAvailable(late.state, HOUR), restedAvailable(s, HOUR) - late.cp); // no refill was invented
});
test('properties: story pays once per step (a tenth of a kill value a step, half a chapter: 100 and 500 at level 1); an unknown story type is refused', () => {
  const r = settleAll(newCareer(0), [story('a', 0, 'ch1/1'), story('b', 1, 'ch1/1'), story('c', 2, 'ch1', true)]);
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[100, 'ok'], [0, 'already-done'], [500, 'ok']]);
  const bad = award(newCareer(0), { kind: 'story', id: 'd', at: 0, step: 'ch2', type: 'mob' as 'story-step' });
  assert.equal(bad.reason, 'bad-event');
});
test('properties: a party larger than four is refused, and a solo row refuses a party', () => {
  assert.equal(award(newCareer(14), { kind: 'kill', id: 'p5', at: 0, type: 'mob', target: 'm', targetLevel: 15, partyLevels: [15, 15, 15, 15] }).reason, 'bad-event');
  assert.equal(award(newCareer(14), kill('p', 'legend', 'goblin', 15, { partyLevels: [15] })).reason, 'bad-event');
});
test('properties: hostile keys: an Object.prototype name as creature kind, boss id or type is a plain key or a refusal, never NaN', () => {
  const repro = award(newCareer(10), { kind: 'kill', id: 'x', at: 0, type: 'mob', target: 'toString', targetLevel: 11 });
  assert.deepEqual([repro.cp, repro.reason, repro.levelBefore, repro.levelAfter], [40, 'ok', 11, 11]);
  assert.equal(restedAvailable(repro.state, 0), 2960);
  assert.deepEqual(repro.state.heat.toString, { units: 360, at: 0 });
  for (const type of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'boss', '']) {
    const a = award(newCareer(10), { kind: 'kill', id: 'y', at: 0, type, target: 'm', targetLevel: 11 });
    assert.deepEqual([a.cp, a.reason, a.levelAfter], [0, 'bad-event', 11], `type ${type}`);
    assert.deepEqual(a.state, newCareer(10), `type ${type}: state untouched`);
  }
  const b = settleAll(newCareer(10), [kill('b1', 'world-boss', '__proto__', 11), kill('b2', 'world-boss', '__proto__', 11)]);
  assert.deepEqual(b.awards.map(a => a.reason), ['ok', 'already-beaten']);
});
test('properties: hostile keys, property run: random streams over prototype names never lower a level or put a non-finite number in state', () => {
  const names = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__defineGetter__', 'prototype', 'm1'];
  const types = ['mob', 'elite', 'named', 'world-boss', 'legend', 'story-step', ...names];
  const finite = (s: CareerState): boolean =>
    [s.credit, s.pitWins, s.rested, s.restedAt, s.pit.rung].every(Number.isFinite)
    && Object.entries(s.heat).every(([, h]) => Number.isFinite(h.units) && Number.isFinite(h.at));
  for (let seed = 1; seed <= 20; seed++) {
    const rnd = lcg(seed * 104_729);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
    let s = newCareer(5 + seed);
    for (let i = 0; i < 600; i++) {
      const at = i * (1 + Math.floor(rnd() * 90));
      const e: CareerEvent = rnd() < 0.9
        ? { kind: 'kill', id: `h${i}`, at, type: pick(types), target: pick(names), targetLevel: 1 + Math.floor(rnd() * 30), contributionPermille: 500 }
        : { kind: 'arena-win', id: `h${i}`, at, opponent: pick(names) };
      const a = award(s, e);
      assert.ok(Number.isSafeInteger(a.cp) && a.cp >= 0, `seed ${seed} event ${i}: cp ${a.cp}`);
      assert.ok(a.levelAfter >= a.levelBefore, `seed ${seed} event ${i}: level ${a.levelBefore} -> ${a.levelAfter}`);
      assert.ok(a.state.credit >= s.credit && finite(a.state), `seed ${seed} event ${i}: state not finite`);
      s = a.state;
    }
    assert.equal(Object.getPrototypeOf(s.heat), Object.prototype); // the '__proto__' kind is an own row, not a prototype swap
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

// Dom's 2026-10-05 ruling: 50 levels, the top rank becoming Origin I–V. Not live yet (the arena Combat track changes src/career.ts);
// these hold the model to it ahead of time by passing the cap.
test('ladder cap 50: a level-46 player under the old top keeps climbing under the new one; a boss tops out the ladder', () => {
  const near50: CareerState = { ...newCareer(48, 0, 50), credit: cumulative(50) - 100 };
  assert.equal(award(near50, kill('b', 'world-boss', 'b', 49), 50).levelAfter, 50);
  assert.equal(award({ ...newCareer(45, 0, 50), credit: cumulative(47) - 1 }, win('x', 0), 50).levelAfter, 47);
  assert.equal(award({ ...newCareer(45), credit: cumulative(47) - 1 }, win('x', 0), 46).levelAfter, 46);
});
