// Pins the ONE-career proposal (docs/specs/origins/progression-proposal.md): the rising requirement curve, the Pit's own ladder with
// legends beaten once, its worked examples and the properties ruling 7 asks for — existing players' level unchanged, credit monotonic,
// a Pit win is one level at the Pit rung, farm yield bounded, no NaN.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_LEVEL as careerMaxLevel, levelOf as careerLevelOf } from '../../src/career.ts';
import { LEGEND_OPPONENTS, rungOf } from '../../src/legends.ts';
import {
  DAY_S, HEAT_UNIT_S, MAX_LEVEL, PER_KILL_CAP_CP, RESTED_CAP_CP, RESTED_PER_DAY_CP,
  award, creditFromMarks, cumulative, falloffPermille, fillPermille, heatAt, heatKills, legendKey, levelOfCredit, levelOfMarks,
  newCareer, nextLegend, partyEligible, partySharePermille, repeatPermille, requirement, restedAvailable, settleAll, tierOf,
  type CareerEvent, type CareerState, type MobClass,
} from './model.ts';
import { CASUAL, HEAVY, HOUR, MIN, botDay, farmGrey, farmLow, mobs, playerDays, regionClear } from './scenarios.ts';

const mobCredit = (awards: { cp: number }[], events: CareerEvent[]): number =>
  awards.reduce((sum, a, i) => sum + (events[i].kind === 'mob' ? a.cp : 0), 0);
const OPP = LEGEND_OPPONENTS;
const win = (id: string, at: number, opponent = 'veteran'): CareerEvent => ({ kind: 'arena-win', id, at, opponent });

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
test('migration: a live account resumes the Pit at its own level with no legend beaten, and keeps its win count for the board', () => {
  const s = newCareer(23);
  assert.deepEqual([s.credit, s.pit.rung, s.pit.beaten.length, s.pitWins], [cumulative(24), 24, 0, 23]);
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
// The Pit: its own ladder, legends beaten once.

test('Pit: a win pays one level at the Pit rung, at every rung, at caps 46 and 50', () => {
  for (const cap of [46, 50]) {
    for (let rung = 1; rung < cap; rung++) {
      const a = award(newCareer(rung - 1, 0, cap), win('w', 0), cap);
      assert.deepEqual([a.cp, a.levelBefore, a.levelAfter, a.state.pit.rung], [requirement(rung), rung, rung + 1, rung + 1], `rung ${rung}`);
    }
  }
});
test('Pit: you resume your rung: level up in the world as a Gladiator and the Pit still offers a Gladiator legend, paying a Gladiator level', () => {
  const s: CareerState = { ...newCareer(10), credit: cumulative(19) }; // world credit took him to Veteran IV; the Pit is at rung 11
  assert.equal(levelOfCredit(s.credit), 19);
  const next = nextLegend(s.pit, OPP, 7);
  assert.ok(next !== null);
  const a = award(s, win('w', 0, next));
  assert.deepEqual([a.cp, a.state.pit.rung, a.state.pit.beaten], [requirement(11), 12, [legendKey(next, 3)]]);
  assert.ok(a.cp < requirement(19)); // less than one of his own levels: the world already paid ahead
});
test('Pit: each legend can be beaten once; a loss is a retry (no event), a second win over the same legend pays nothing', () => {
  const s = settleAll(newCareer(10), [win('a', 0, 'goblin'), win('b', 1, 'goblin')]);
  assert.deepEqual(s.awards.map(a => [a.cp, a.reason]), [[requirement(11), 'ok'], [0, 'already-done']]);
  assert.equal(s.state.pit.rung, 12);
  // The same opponent at a different title is a different legend.
  const t = settleAll({ ...newCareer(14), pit: { rung: 15, beaten: [legendKey('goblin', 3)] } }, [win('c', 0, 'goblin'), win('d', 1, 'goblin')]);
  assert.deepEqual(t.awards.map(a => a.reason), ['already-done', 'already-done']); // rung 15 is still Gladiator (tier 3)
  const u = award({ ...newCareer(15), pit: { rung: 16, beaten: [legendKey('goblin', 3)] } }, win('e', 0, 'goblin'));
  assert.equal(u.reason, 'ok'); // rung 16 is Veteran: a new goblin legend
});
test('Pit: the next opponent is always an unbeaten legend of the rung\'s title, picked by the key, never at the top rung', () => {
  const rnd = lcg(11);
  for (let i = 0; i < 400; i++) {
    const rung = 1 + Math.floor(rnd() * 45);
    const tier = tierOf(rung);
    const beaten = OPP.filter(() => rnd() < 0.5).map(o => legendKey(o, tier));
    const pick = nextLegend({ rung, beaten }, OPP, Math.floor(rnd() * 2 ** 32));
    if (beaten.length === OPP.length) assert.equal(pick, null);
    else assert.ok(pick !== null && !beaten.includes(legendKey(pick, tier)));
  }
  assert.equal(nextLegend({ rung: 46, beaten: [] }, OPP, 1, 46), null);
  assert.ok(nextLegend({ rung: 46, beaten: [] }, OPP, 1, 50) !== null); // Origin I–V are legends under the 50-level ladder
});
test('Pit: Origin by Pit wins alone is one named fight per rung, five per title, each a different legend; after that the opponents are mass-produced', () => {
  for (const cap of [46, 50]) {
    let s = newCareer(0, 0, cap);
    for (let w = 0; w < cap - 1; w++) {
      const opponent = nextLegend(s.pit, OPP, w * 7919, cap);
      assert.ok(opponent !== null);
      s = award(s, win(`w${w}`, w, opponent), cap).state;
    }
    assert.equal(levelOfCredit(s.credit, cap), cap);
    assert.equal(s.credit, cumulative(cap));
    assert.equal(new Set(s.pit.beaten).size, cap - 1);
    for (let tier = 1; tier <= 9; tier++) assert.equal(s.pit.beaten.filter(k => k.endsWith(`@${tier}`)).length, 5);
    const top = award(s, win('top', 99, 'anyone'), cap);
    assert.deepEqual([top.reason, top.cp, top.state.pit.beaten.length, top.state.pitWins], ['ok', requirement(cap), cap - 1, cap]);
  }
});
test('Pit: an empty or malformed opponent is refused below the top rung', () => {
  for (const opponent of ['', 'a@3', 7 as unknown as string]) assert.equal(award(newCareer(5), win('x', 0, opponent)).reason, 'bad-event');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The other tables.

test('constants (the proposal table): rested allowance and per-kill cap stay fixed in CP', () => {
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
test('repeat heat rounds UP: three kills in a row pay in full and the fourth is reduced whenever kills come close together', () => {
  assert.deepEqual([0, 1, 359, 360, 361, 719, 720, 721].map(heatKills), [0, 1, 1, 1, 2, 2, 2, 3]);
  // The rule in one line: four kills of one kind inside six minutes (gaps under 120 s), and the fourth is reduced.
  for (const gap of [1, 30, 75, 119]) {
    const r = settleAll(newCareer(14), mobs(0, gap, 4, `kind-${gap}`, 'ordinary', 15));
    assert.deepEqual(r.awards.map(a => a.cp), [20, 20, 20, 15], `kills ${gap} s apart`);
  }
  for (const gap of [120, 179]) {
    const r = settleAll(newCareer(14), mobs(0, gap, 4, `kind-${gap}`, 'ordinary', 15));
    assert.deepEqual(r.awards.map(a => a.cp), [20, 20, 20, 20], `kills ${gap} s apart`);
  }
  // Kills a full six minutes apart never heat.
  assert.deepEqual(settleAll(newCareer(14), mobs(0, HEAT_UNIT_S, 6, 'slow', 'ordinary', 15)).awards.map(a => a.cp), [20, 20, 20, 20, 20, 20]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Bosses.

test('boss ≈ one level at its rank: an even-level solo boss pays exactly one of your levels', () => {
  for (const l of [5, 16, 30, 45]) {
    const a = award(newCareer(l - 1), { kind: 'boss', id: 'b', at: 0, boss: 'steward', bossLevel: l, contributionPermille: 1000 });
    assert.deepEqual([a.cp, a.levelAfter], [requirement(l), l + 1]);
  }
});
test('boss ≈ one level at its rank: never more than one of your levels; below you, its own level with the falloff', () => {
  for (let d = -20; d <= 20; d++) {
    const cp = award(newCareer(29), { kind: 'boss', id: 'b', at: 0, boss: 'x', bossLevel: 30 + d, contributionPermille: 500 }).cp;
    assert.ok(cp <= requirement(30));
    assert.equal(cp, d >= 0 ? requirement(30) : Math.floor((requirement(30 + d) * falloffPermille(d)) / 1000));
  }
});
test('boss: rolling 7-day lockout per boss; a grey kill does not start it', () => {
  const k = (id: string, at: number, bossLevel = 16): CareerEvent => ({ kind: 'boss', id, at, boss: 'count', bossLevel, contributionPermille: 400 });
  const r = settleAll(newCareer(15), [k('a', 0), k('b', 7 * DAY_S - 1), k('c', 7 * DAY_S)]);
  // The first kill made him level 17, so the same level-16 boss a week later is one below him: its own level × 0.9.
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[3400, 'ok'], [0, 'locked-out'], [3060, 'ok']]);
  const g = settleAll(newCareer(30), [k('g', 0), k('h', 60)]);
  assert.deepEqual(g.awards.map(a => a.reason), ['grey', 'grey']);
  assert.deepEqual(g.state.bossAt, {});
});
test('boss: needs a real share of the fight', () => {
  const e = (c: number): CareerEvent => ({ kind: 'boss', id: `c${c}`, at: 0, boss: 'b', bossLevel: 16, contributionPermille: c });
  assert.equal(award(newCareer(15), e(99)).reason, 'low-contribution');
  assert.equal(award(newCareer(15), e(100)).cp, requirement(16));
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Worked examples.

const regionEvents = regionClear();
const region = settleAll(newCareer(10), regionEvents);
const by = (pick: (e: CareerEvent) => boolean): number => region.awards.reduce((sum, a, i) => sum + (pick(regionEvents[i]) ? a.cp : 0), 0);
test('worked example A: a Gladiator I clears region 1 and chapter one: pins the evening', () => {
  assert.equal(newCareer(10).credit, 14_500);
  assert.equal(by(e => e.kind === 'boss'), 6925);
  assert.equal(by(e => e.kind === 'story'), 900);
  assert.equal(by(e => e.kind === 'mob'), 2160);
  assert.equal(by(e => e.kind === 'mob' && e.mob === 'ash-hound'), 142);
  assert.equal(by(e => e.kind === 'mob' && e.mobClass === 'elite'), 1005);
  assert.equal(by(e => e.kind === 'mob' && e.mobClass === 'named'), 500);
  assert.equal(region.state.credit, 24_485);
  assert.equal(levelOfCredit(region.state.credit), 15); // Gladiator I → Gladiator V
  assert.equal(restedAvailable(region.state, 155 * MIN), 1000);
  assert.equal(region.state.pit.rung, 11); // the Pit waits at Gladiator I
});
test('worked example A: bosses and story are most of it; creatures are the smaller share', () => {
  assert.ok(by(e => e.kind === 'mob') * 3 < by(e => e.kind !== 'mob')); // 2,160 of 9,985: 22%
});

const lvl30 = newCareer(29);
test('worked example B: a level-30 farming low creatures: B1: an hour on region-1 hounds (grey) pays nothing, but still heats the kind', () => {
  const r = settleAll(lvl30, farmGrey(0));
  assert.equal(r.state.credit - lvl30.credit, 0);
  assert.equal(r.awards.every(a => a.reason === 'grey'), true);
  assert.ok(heatAt(r.state, 'ash-hound', 120 * 30) > 0);
});
test('worked example B: B2: an hour on one level-25 kind pays 26 CP, 0.2% of a level at 30', () => {
  const r = settleAll(lvl30, farmLow(0));
  assert.equal(r.state.credit - lvl30.credit, 26);
  assert.deepEqual(r.awards.slice(0, 8).map(a => a.cp), [4, 4, 4, 3, 2, 2, 1, 1]);
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
test('worked example B: B4: the same bot for a week earns 4,848 CP: its kinds stay hot and the week is still a third of one level', () => {
  const r = settleAll(lvl30, botDay(0, 24 * 7));
  assert.equal(r.state.credit - lvl30.credit, 4848);
  assert.equal(levelOfCredit(r.state.credit), 30);
});

const party = [14, 15, 16, 20];
const share = [300, 250, 350, 100];
const others = (i: number, levels = party): number[] => levels.filter((_, j) => j !== i);
test('worked example C: a party of four kills a boss: each eligible member gets one of their own levels; the over-level member gets the falloff', () => {
  const cps = party.map((lvl, i) =>
    award(newCareer(lvl - 1), { kind: 'boss', id: `count-${i}`, at: 0, boss: 'count', bossLevel: 16, partyLevels: others(i), contributionPermille: share[i] }).cp);
  assert.deepEqual(cps, [2700, 3025, 3400, 1700]);
  assert.deepEqual(cps.slice(0, 3), [14, 15, 16].map(requirement));
});
test('worked example C: an Origin carry earns nothing and makes the others ineligible', () => {
  const levels = [15, 16, 20, 46];
  const reasons = levels.map((lvl, i) =>
    award(newCareer(lvl - 1), { kind: 'boss', id: `c-${i}`, at: 0, boss: 'count', bossLevel: 16, partyLevels: others(i, levels), contributionPermille: 250 }).reason);
  assert.deepEqual(reasons, ['not-eligible', 'not-eligible', 'not-eligible', 'grey']);
});
test('worked example C: their elite kills split EverQuest-style and take the highest member\'s colour', () => {
  const elite = (lvl: number, partyLevels: number[]): number =>
    award(newCareer(lvl - 1), { kind: 'mob', id: 'e', at: 0, mob: 'court-sentinel', mobClass: 'elite', mobLevel: 15, partyLevels }).cp;
  assert.equal(elite(15, [14, 16, 20]), 7); // 80 × 0.2 (grey-ish for the level 20) × 0.45
  assert.equal(elite(15, [14, 16]), 40); // 80 × 0.9 × 0.566
  assert.equal(elite(15, []), 80);
});

test('worked example D: days to each title, casual (30 min) and heavy (3 h), at cap 46 and 50; creatures stay under 2% of the climb', () => {
  const titles = [6, 11, 16, 21, 26, 31, 36, 41, 46];
  const runs = [[CASUAL, [3, 5, 7, 9, 12, 15, 18, 22, 26], 29], [HEAVY, [1, 1, 1, 2, 2, 3, 3, 4, 4], 5]] as const;
  for (const [p, days, origin5] of runs) {
    const run = playerDays(p, OPP, 3000);
    assert.deepEqual(titles.map(l => run.dayReached[l]), days, p.name);
    const total = run.credit.pit + run.credit.boss + run.credit.story + run.credit.mob;
    assert.ok(run.credit.mob * 50 < total, `${p.name}: creatures ${run.credit.mob} of ${total}`);
    assert.equal(playerDays(p, OPP, 3000, 50).dayReached[50], origin5, `${p.name}: Origin V at cap 50`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Properties.

function randomStream(seed: number, n: number): CareerEvent[] {
  const rnd = lcg(seed);
  const out: CareerEvent[] = [];
  let t = 0;
  const classes: MobClass[] = ['ordinary', 'elite', 'named'];
  for (let i = 0; i < n; i++) {
    t += Math.floor(rnd() * 600) - 30; // occasionally out of order
    const pick = rnd();
    const id = rnd() < 0.05 && i > 0 ? out[Math.floor(rnd() * out.length)].id : `e${i}`; // retries
    if (pick < 0.1) out.push({ kind: 'arena-win', id, at: t, opponent: OPP[Math.floor(rnd() * OPP.length)] });
    else if (pick < 0.2) out.push({ kind: 'boss', id, at: t, boss: `b${Math.floor(rnd() * 5)}`, bossLevel: 11 + Math.floor(rnd() * 36), contributionPermille: Math.floor(rnd() * 400) });
    else if (pick < 0.25) out.push({ kind: 'story', id, at: t, step: `s${Math.floor(rnd() * 20)}`, cp: Math.floor(rnd() * 1200) });
    else out.push({ kind: 'mob', id, at: t, mob: `m${Math.floor(rnd() * 12)}`, mobClass: classes[Math.floor(rnd() * 3)], mobLevel: 11 + Math.floor(rnd() * 36), partyLevels: rnd() < 0.3 ? [11 + Math.floor(rnd() * 36)] : undefined });
  }
  return out;
}
test('properties: credit and level never go down, no award is negative, and the career level is never below the Pit rung (random streams)', () => {
  for (const cap of [46, 50]) {
    for (let seed = 1; seed <= 20; seed++) {
      const r = settleAll(newCareer(10 + seed, 0, cap), randomStream(seed, 1500), new Set(), cap);
      let credit = creditFromMarks(10 + seed, cap);
      for (const a of r.awards) {
        assert.ok(Number.isSafeInteger(a.cp) && a.cp >= 0);
        assert.ok(a.state.credit >= credit);
        assert.ok(a.levelAfter >= a.levelBefore);
        assert.ok(a.levelAfter >= a.state.pit.rung, `level ${a.levelAfter} below rung ${a.state.pit.rung}`);
        assert.equal(new Set(a.state.pit.beaten).size, a.state.pit.beaten.length); // no legend beaten twice
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
  assert.equal(again.state.credit, cumulative(14));
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
  assert.equal(award(dry, win('p', 0)).cp, requirement(15));
  assert.equal(award(dry, { kind: 'boss', id: 'x', at: 0, boss: 'x', bossLevel: 15, contributionPermille: 200 }).cp, requirement(15));
});
test('properties: a late event never rewinds the clocks (no free refill from clock skew)', () => {
  const s = settleAll({ ...newCareer(14), rested: 0, restedAt: 0 }, mobs(HOUR, 1, 1, 'k', 'ordinary', 15)).state;
  const late = award(s, { kind: 'mob', id: 'late', at: 0, mob: 'k2', mobClass: 'ordinary', mobLevel: 15 });
  assert.equal(late.cp, 20);
  assert.equal(late.state.restedAt, HOUR);
  assert.equal(restedAvailable(late.state, HOUR), restedAvailable(s, HOUR) - late.cp); // no refill was invented
});
test('properties: story steps pay once (100 a step, 500 a chapter), never more than the bound', () => {
  const r = settleAll(newCareer(10), [
    { kind: 'story', id: 'a', at: 0, step: 'ch1/1', cp: 100 },
    { kind: 'story', id: 'b', at: 1, step: 'ch1/1', cp: 100 },
    { kind: 'story', id: 'c', at: 2, step: 'ch1', cp: 500 },
    { kind: 'story', id: 'd', at: 3, step: 'ch2', cp: 1001 },
  ]);
  assert.deepEqual(r.awards.map(a => [a.cp, a.reason]), [[100, 'ok'], [0, 'already-done'], [500, 'ok'], [0, 'bad-event']]);
});
test('properties: a party larger than four is refused', () => {
  assert.equal(award(newCareer(14), { kind: 'mob', id: 'p5', at: 0, mob: 'm', mobClass: 'ordinary', mobLevel: 15, partyLevels: [15, 15, 15, 15] }).reason, 'bad-event');
});
test('properties: hostile keys: an Object.prototype name as mob kind, boss id or mob class is a plain key or a refusal, never NaN', () => {
  // The review repro: mob 'toString' at level 11 used to pay NaN, drop the level to 1 and leave a NaN heat row.
  const repro = award(newCareer(10), { kind: 'mob', id: 'x', at: 0, mob: 'toString', mobClass: 'ordinary', mobLevel: 11 });
  assert.deepEqual([repro.cp, repro.reason, repro.levelBefore, repro.levelAfter], [20, 'ok', 11, 11]);
  assert.equal(restedAvailable(repro.state, 0), 2980);
  assert.deepEqual(repro.state.heat.toString, { units: 360, at: 0 });
  for (const cls of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'boss', '']) {
    const a = award(newCareer(10), { kind: 'mob', id: 'y', at: 0, mob: 'm', mobClass: cls as MobClass, mobLevel: 11 });
    assert.deepEqual([a.cp, a.reason, a.levelAfter], [0, 'bad-event', 11], `mobClass ${cls}`);
    assert.deepEqual(a.state, newCareer(10), `mobClass ${cls}: state untouched`);
  }
});
test('properties: hostile keys, property run: random streams over prototype names never lower a level or put a non-finite number in state', () => {
  const names = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__defineGetter__', 'prototype', 'm1'];
  const classes = ['ordinary', 'elite', 'named', ...names];
  const finite = (s: CareerState): boolean =>
    [s.credit, s.pitWins, s.rested, s.restedAt, s.pit.rung].every(Number.isFinite)
    && Object.entries(s.heat).every(([, h]) => Number.isFinite(h.units) && Number.isFinite(h.at))
    && Object.entries(s.bossAt).every(([, t]) => Number.isFinite(t));
  for (let seed = 1; seed <= 20; seed++) {
    const rnd = lcg(seed * 104_729);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
    let s = newCareer(5 + seed);
    for (let i = 0; i < 600; i++) {
      const at = i * (1 + Math.floor(rnd() * 90));
      const roll = rnd();
      const e: CareerEvent = roll < 0.6
        ? { kind: 'mob', id: `h${i}`, at, mob: pick(names), mobClass: pick(classes) as MobClass, mobLevel: 1 + Math.floor(rnd() * 30) }
        : roll < 0.9
          ? { kind: 'boss', id: `h${i}`, at, boss: pick(names), bossLevel: 1 + Math.floor(rnd() * 30), contributionPermille: 500 }
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
const CAP50 = 50;
test('ladder cap 50: a level-46 player under the old top keeps climbing under the new one; a boss tops out the ladder', () => {
  assert.equal(award(newCareer(45, 0, CAP50), win('x', 0), CAP50).levelAfter, 47);
  assert.equal(award(newCareer(45), win('x', 0), 46).levelAfter, 46);
  const boss = award(newCareer(48, 0, CAP50), { kind: 'boss', id: 'b', at: 0, boss: 'b', bossLevel: 49, contributionPermille: 500 }, CAP50);
  assert.deepEqual([boss.cp, boss.levelAfter], [requirement(49), CAP50]);
});
test('ladder cap 50: no band breaks — falloff, boss and mob credit depend only on the level difference and the curve, at every level', () => {
  for (let level = 1; level <= CAP50; level++) {
    for (let d = -12; d <= 12; d++) {
      const target = level + d;
      if (target < 1) continue;
      const boss = award(newCareer(level - 1, 0, CAP50), { kind: 'boss', id: 'b', at: 0, boss: 'b', bossLevel: target, contributionPermille: 500 }, CAP50).cp;
      assert.equal(boss, Math.floor((requirement(Math.min(target, level)) * Math.min(1000, falloffPermille(d))) / 1000), `boss at level ${level}, d ${d}`);
      const mob = award(newCareer(level - 1, 0, CAP50), { kind: 'mob', id: 'm', at: 0, mob: 'm', mobClass: 'named', mobLevel: target }, CAP50).cp;
      assert.equal(mob, Math.min(PER_KILL_CAP_CP, Math.floor((200 * falloffPermille(d)) / 1000)), `mob at level ${level}, d ${d}`);
    }
    assert.equal(partyEligible(level, level), true);
  }
  assert.equal(partyEligible(34, CAP50), true); // gap 16 ≤ 17
  assert.equal(partyEligible(33, CAP50), false); // gap 17 > 16
});
