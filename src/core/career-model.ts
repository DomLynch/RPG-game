// Frankendom: Origins — the ONE career (Dom's ruling 7), reference model. Pure, integer-only, not under src/.
// Its one import is the ladder's title width (src/core/career-ladder.ts: RANK_STEPS); the career's own cap and curve are the LEVEL_CURVE row below.
//
// Spec: docs/specs/src/core/career-model.ts-proposal.md (this file is its executable half; the numbers below are the proposal's numbers
// and every one is pinned in model.test.ts). Clean room (ruling 8): written from the specs in docs/specs/origins/ only.
//
// The whole idea (Dom, 2026-10-06: a UNIVERSAL levelling system, content later): the career is a single integer, CAREER CREDIT (CP).
// The level is read from credit through a RISING requirement curve. Everything that pays credit pays the same way:
//
//     cp = killValue(min(target level, your level)) × falloff(target − you) × TYPE WEIGHT
//
// killValue is the LINEAR part of the curve: equal to the requirement up to level 10, then left behind by the curve's square term from
// Gladiator I (level 11). So every single kill, fight or step is a shrinking part of a level from Gladiator on, and nothing in the pay
// reads how many bosses, legends or creatures exist. The type weight is a table row (legend, world boss, named, elite, mob, story);
// a new kind of content plugs in by adding one row, never by touching the curve. A row says whether it pays once (bosses: a
// per-character beaten flag, cleared at the top level, when every boss reopens), whether it draws on the rested allowance and heat
// (creatures), and how a party shares it. Credit only ever goes up.
//
// Server use: the authoritative world server (or the verifier, for Pit wins) calls `award(state, event)` once per verified event,
// with the server clock. The function never reads a clock, a random number or a device value; the same state and event give the same
// award on every sweep, so a retried settlement can be checked byte for byte.

// ---------------------------------------------------------------------------------------------------------------------------------
// Constants (the proposal's table; change them only with the doc).

import { MAX_LEVEL as LADDER_MAX_LEVEL, RANK_STEPS } from './career-ladder.ts';
import CAREER_RULES from './career-rules.json' with { type: 'json' };

// The pacing numbers are the one row of career-rules.json (careerRule); the names below keep their exports.
const RULE = CAREER_RULES.careerRule[0]!;


// THE LEVEL CURVE ROW (Dom's re-lock, #2408 2a; Strategy ruling 2026-10-12): the zone career runs level 0 (born) to maxLevel 100, and the whole curve is this
// one row, not constants spread through the code. A level's cost is priced in KILLS of the reference boss row at the level being left:
//   kills(L) = early.kills for the first early.levels levels (L < early.levels), then early.kills + ramp·(L − early.levels + 1) + rank·⌊L / rankLevels⌋,
//   cost(L)  = ⌊ bossPay(max(1, L)) · kills(L) / 1000 ⌋,   bossPay(l) = ⌊ killValue(l) · weight(boss) / 1000 ⌋.
// Levels 0–9 are the opening, priced in Pit wins (`opening` below); from level 10 the boss-kill pricing above applies, ramps with the level and steepens
// again at every rank-up (10, 20 … 90) because re-spread is once per rank-up. The Pit ladder (career-ladder.ts MAX_LEVEL 50, marks) is a different track and is untouched.
type CurveRow = { maxLevel: number; boss: string; killBase: number; killStep: number; earlyLevels: number; earlyKills: number; ramp: number; rank: number; rankLevels: number; opening: readonly number[] };
const CURVE = CAREER_RULES.levelCurve[0] as CurveRow;   // the levelCurve row of career-rules.json (every default equals the literal this replaced; tests/career-rules.test.ts pins it)
// The opening: levels 0–9 are priced in Pit legend WINS at the lowest rank (Strategy ruling 2026-10-13: level 1 = 1 win, level 5 ≈ 5 minutes, level 10 = a first session of ~35 wins),
// not in boss kills: wins[L] wins at the pay of a legend at level L buy level L → L + 1 (`opening`). From level 10 the boss-kill pricing above applies unchanged.
export const LEVEL_CURVE = {
  maxLevel: CURVE.maxLevel,
  boss: CURVE.boss,
  killBase: CURVE.killBase, killStep: CURVE.killStep,   // killValue(l) = killBase + killStep·(l − 1): the CP of one even-level kill at weight 1000
  early: { levels: CURVE.earlyLevels, kills: CURVE.earlyKills },   // permille of a boss kill: the base from level 10 (levels 5.. add the ramp)
  ramp: CURVE.ramp,                                 // permille added per level from level 5
  rank: CURVE.rank,                                 // permille added per whole rank passed
  rankLevels: CURVE.rankLevels,
  opening: CURVE.opening,
} as const;
export const CAREER_MAX_LEVEL: number = LEVEL_CURVE.maxLevel;

// Every keyed lookup that takes a string from an event (type row, creature kind) goes through `own`, so a key such as 'toString',
// 'constructor' or '__proto__' reads as absent instead of finding something on Object.prototype.
const own = <T>(rec: Readonly<Record<string, T>>, key: string): T | undefined =>
  (Object.hasOwn(rec, key) ? rec[key] : undefined);

// ---------------------------------------------------------------------------------------------------------------------------------
// The type-weight table: the ONE place content is priced. weight = permille of the kill value at the target's level.
//   once     — pays the first win only (a per-character beaten flag, keyed type:target; cleared at the top level).
//   rested   — paid out of the rested allowance, with repeat heat per target kind (creatures).
//   party    — 'split': EverQuest group shape, highest member's colour; 'each': every eligible member gets their own award, given a real
//              share of the fight; 'solo': one character (the Pit, story).
//   atOwn    — no target: priced at your own level with no falloff (story).
//   early    — a different weight while the priced level is below `below` (the Pit's taper, Dom 2026-10-06: a fifth of a level to L10).
export type TypeRow = {
  weight: number; once: boolean; rested: boolean; party: 'split' | 'each' | 'solo'; atOwn?: boolean; early?: { below: number; weight: number };
};
export type TypeTable = Readonly<Record<string, TypeRow>>;
type TypeRule = { id: string; weight: number; once: boolean; rested: boolean; party: TypeRow['party']; atOwn?: boolean; earlyBelow?: number; earlyWeight?: number };
export const TYPE_WEIGHTS: TypeTable = Object.fromEntries((CAREER_RULES.typeWeight as readonly TypeRule[]).map((r): [string, TypeRow] => [r.id, {
  weight: r.weight, ...(r.earlyBelow === undefined ? {} : { early: { below: r.earlyBelow, weight: r.earlyWeight! } }), once: r.once, rested: r.rested, party: r.party, ...(r.atOwn ? { atOwn: true } : {}),
}]));
export const isType = (types: TypeTable, t: unknown): t is string => typeof t === 'string' && own(types, t) !== undefined;

// Level-difference falloff, permille, by d = target level − your level. CAP-INDEPENDENT by construction: it reads only the
// difference d, never an absolute level. The one ladder fact it uses is the title width (src/core/career-ladder.ts RANK_STEPS, five sub-ranks a
// title): exactly one title below you pays a fifth, and anything more than a whole title below you is grey and pays nothing.
export function falloffPermille(d: number): number {
  if (d >= 3) return 1250;
  if (d >= 1) return 1100;
  if (d === 0) return 1000;
  if (d >= -2) return 900;
  if (d >= -4) return 500;
  if (d >= -RANK_STEPS) return 200;
  return 0; // grey
}
export const isGrey = (d: number): boolean => falloffPermille(d) === 0;

// Party share for 'split' rows (EverQuest's group shape): pool = X·(1 + g/2), g = 1 + 0.2·(n−1); each member gets pool/n.
export const MAX_PARTY = RULE.maxParty;
export function partySharePermille(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTY) return 0;
  if (n === 1) return 1000;
  const g = 1000 + 200 * (n - 1);
  return Math.floor((1000 + g / 2) / n); // n=2 800, n=3 566, n=4 450
}
// A member is eligible for party credit only if within the level gap of the party's highest member: gap ≤ max(5, floor(L/2)).
export const partyEligible = (memberLevel: number, highestLevel: number): boolean =>
  highestLevel - memberLevel <= Math.max(5, Math.floor(memberLevel / 2));
// An 'each' row (a boss) pays a member only for a real share of the fight.
export const MIN_CONTRIBUTION_PERMILLE = RULE.minContributionPermille; // ≥ 10% of the boss's health dealt (or the server's equivalent share)

// Repeat-kill heat, per character per target KIND (definition id, not spawn instance), for rested rows. Each kill adds one unit
// (HEAT_UNIT_S seconds of heat); heat drains one second per second, so a kind cools fully six minutes after one kill. Before a kill
// the heat is read as h = CEIL(units / HEAT_UNIT_S): any heat left over from a kill still counts as that whole kill, so the first
// FREE_REPEATS kills of a kind pay in full and the next one is reduced whenever kills come closer than six minutes apart. After that
// the kill pays FREE_REPEATS / (h + 1).
export const HEAT_UNIT_S = RULE.heatUnitSeconds;
export const FREE_REPEATS = RULE.freeRepeats;
export const heatKills = (units: number): number => Math.max(0, Math.ceil(units / HEAT_UNIT_S));
export function repeatPermille(heatUnits: number): number {
  const h = Math.max(0, Math.floor(heatUnits));
  return h < FREE_REPEATS ? 1000 : Math.floor((FREE_REPEATS * 1000) / (h + 1));
}

// Rested allowance (WoW's rested pool, turned into the ceiling): rested rows are paid out of a pool that refills at
// RESTED_PER_DAY_CP and holds at most RESTED_CAP_CP. Empty pool: the kill still drops loot and counts for quests, but pays 0 CP.
// Other rows never touch the pool. Stored scaled by DAY_S so the refill is exact in integers. Fixed in CP at every level (decided,
// Dom 2026-10-06): as the requirement rises, a day's allowance is a shrinking part of a level.
export const DAY_S = 86_400;
export const RESTED_PER_DAY_CP = RULE.restedPerDayCp;
export const RESTED_CAP_CP = RULE.restedCapCp;
const RESTED_CAP_UNITS = RESTED_CAP_CP * DAY_S;

// ---------------------------------------------------------------------------------------------------------------------------------
// Levels. Every level function takes the cap, defaulting to LEVEL_CURVE.maxLevel; the curve never reads the cap, so a lower cap shares every row.

const wholeLevel = (level: number): number => (Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1);
const careerLevel = (level: number): number => (Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0);
// The value of one even-level kill at weight 1000: the linear price the pay rule reads.
export const killValue = (level: number): number => LEVEL_CURVE.killBase + LEVEL_CURVE.killStep * (wholeLevel(level) - 1);
const bossPay = (level: number): number => Math.floor((killValue(level) * TYPE_WEIGHTS[LEVEL_CURVE.boss]!.weight) / 1000);
const killsPermille = (l: number): number => {
  const c = LEVEL_CURVE;
  return c.early.kills + (l < c.early.levels ? 0 : c.ramp * (l - c.early.levels + 1) + c.rank * Math.floor(l / c.rankLevels));
};
// CP to go from level L to L + 1 (L = 0 is the birth level).
export const requirement = (level: number): number => {
  const l = Math.min(careerLevel(level), LEVEL_CURVE.maxLevel - 1);
  if (l < LEVEL_CURVE.opening.length) return LEVEL_CURVE.opening[l]! * Math.floor((killValue(l) * TYPE_WEIGHTS.legend!.early!.weight) / 1000);
  return Math.floor((bossPay(l) * killsPermille(l)) / 1000);
};
const CUMULATIVE: readonly number[] = (() => { const t = [0]; for (let l = 0; l < LEVEL_CURVE.maxLevel; l++) t.push(t[l]! + requirement(l)); return t; })();
// CP to reach level L from nothing. cumulative(100) is the whole career, the curve's named asymptote (CAREER_CP).
export const cumulative = (level: number): number => CUMULATIVE[Math.min(careerLevel(level), LEVEL_CURVE.maxLevel)]!;
export const CAREER_CP = cumulative(LEVEL_CURVE.maxLevel);
// WHAT DRIVES RANK: this, and only this. Title, sub-rank, gates and the rank bar all read levelOfCredit(credit, cap).
export function levelOfCredit(credit: number, cap: number = CAREER_MAX_LEVEL): number {
  if (!Number.isFinite(credit) || credit <= 0) return 0;
  let level = 0;
  while (level < cap && cumulative(level + 1) <= credit) level++;
  return level;
}
// The level the TITLE ladder, shop, gear and gates read (contracts/world.ts: a career level is 1..LADDER_MAX_LEVEL): the career level clamped onto it. Levels 51-100 are build points, not new titles.
export const standingLevel = (credit: number): number => Math.min(LADDER_MAX_LEVEL, Math.max(1, levelOfCredit(credit)));
// The rank bar's partial fill (src/core/career-ladder.ts Rank.fill, kept at 0 today "so the bar code reads unchanged"), permille of the level.
export function fillPermille(credit: number, cap: number = CAREER_MAX_LEVEL): number {
  const level = levelOfCredit(credit, cap);
  if (level === cap) return 0;
  return Math.floor(((Math.floor(credit) - cumulative(level)) * 1000) / requirement(level));
}
// The title tier (1..10) of a level: five sub-ranks a title, Origin (tier 10) from level 46 on.
export const tierOf = (level: number): number => Math.min(10, Math.floor((wholeLevel(level) - 1) / RANK_STEPS) + 1);
// The top level reopens every boss (Dom, 2026-10-06): reaching the cap clears the beaten flags, and while at the cap none is kept.
export const allBossesOpen = (level: number, cap: number = CAREER_MAX_LEVEL): boolean => wholeLevel(level) >= cap;

// The one pay rule. target = the target's level (ignored for atOwn rows); you = your level before the event.
export const weightAt = (row: TypeRow, level: number): number => row.early && wholeLevel(level) < row.early.below ? row.early.weight : row.weight;
export function basePay(row: TypeRow, target: number, you: number): number {
  if (row.atOwn) return Math.floor((killValue(you) * weightAt(row, you)) / 1000);
  const at = Math.min(target, you);
  return Math.floor((killValue(at) * falloffPermille(target - you) * weightAt(row, at)) / 1e6);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The Pit (proposal §3, for the arena Lead after the beta). A Pit fight is fought at your own level (the live dial), against one of the
// opponents; each opponent at each level is one legend, a 'legend' row: it pays its first win only. The model never counts legends:
// the server says who was beaten, and the key is opponent@level. `pit.rung` is the level the Pit last fought at (display, and the
// migration's resume point); it is never above the career level.
export type PitState = { rung: number };
export const legendKey = (opponent: string, level: number): string => `legend:${opponent}@${careerLevel(level)}`;
// The next opponent: one not yet beaten at your level, picked by `key` the way src/ladder.ts nextOpponent picks from the pass today
// (key = a hash of the profile and its Pit wins, so the HUD and the Next button agree). null when every opponent at this level is
// beaten: the Pit then waits for the world to raise your level (or, at the top, every legend is open again).
export function nextLegend(state: CareerState, opponents: readonly string[], key: number, cap: number = CAREER_MAX_LEVEL): string | null {
  const level = levelOfCredit(state.credit, cap);
  const left = opponents.filter(o => !state.beaten.includes(legendKey(o, level)));
  return left.length ? left[(key >>> 0) % left.length] : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// State and events.

export type Heat = { units: number; at: number }; // units in seconds of heat, at = server seconds of the last update
export type CareerState = {
  credit: number; // CP, integer, never decreases
  pit: PitState;
  pitWins: number; // display only (the Pit board); not used for rank
  rested: number; // CP × DAY_S
  restedAt: number; // server seconds of the last rested update
  heat: Readonly<Record<string, Heat>>; // by creature kind
  beaten: readonly string[]; // once-rows already paid, `type:target` (legends `legend:opponent@level`); cleared at the top level
  story: readonly string[]; // story ids already paid (story is once ever, never reopened)
};
// Event ids already settled are NOT career state: they are the server's unique index (loot_claims.fight_hash today; an encounter id
// for world kills). `settleAll` models that index with a Set so a retried event pays nothing.

// A new zone character: level 0, no credit, nothing beaten, a full allowance. Pit marks never seed it (C6): the Pit's wins pay Pit ranks only (levelOf in career-ladder.ts), the zone's level is read from credit alone (levelOfCredit).
export const newCareer = (at = 0): CareerState => careerAtLevel(0, at);
// A career standing at an exact level: the Pit session's own track, simulations and tests. Never a path from a Pit win count to a zone level.
export const careerAtLevel = (level: number, at = 0, cap: number = CAREER_MAX_LEVEL): CareerState => {
  const l = Math.min(cap, careerLevel(level));
  return { credit: cumulative(l), pit: { rung: l }, pitWins: Math.max(0, l - 1), rested: RESTED_CAP_UNITS, restedAt: at, heat: {}, beaten: [], story: [] };
};
// Pure: the writer's career row -> the career state. The one mapping the server (career, mob-rewards, story) and the zone page (origins/preview/save.ts) share.
export type CareerRowShape = { total_credit: number; rested: number; rested_at: number; heat: Record<string, unknown>; beaten: string[]; story: string[] };
export function careerState(row: CareerRowShape): CareerState {
  return { credit: Number(row.total_credit), pit: { rung: 0 }, pitWins: 0, rested: Number(row.rested), restedAt: Number(row.rested_at), heat: row.heat as CareerState['heat'], beaten: row.beaten, story: row.story };
}

// Every event has an id the server made (fight hash, encounter id, story step) and a server time in whole seconds.
export type ArenaWin = { kind: 'arena-win'; id: string; at: number; opponent: string }; // the opponent the server says was beaten
export type Kill = {
  kind: 'kill'; id: string; at: number;
  type: string; // a TYPE_WEIGHTS row
  target: string; // the boss id, or the creature definition id (the repeat key)
  targetLevel: number;
  partyLevels?: readonly number[]; // the OTHER members' career levels at engage (server roster); absent = solo
  present?: boolean; // 'split': party member was in range and engaged (server); solo killers are present by definition
  contributionPermille?: number; // 'each': this member's verified share of the fight (server)
};
export type StoryStep = { kind: 'story'; id: string; at: number; step: string; type: 'story-step' | 'story-chapter' };
export type CareerEvent = ArenaWin | Kill | StoryStep;

export type Reason =
  | 'ok' | 'duplicate' | 'grey' | 'not-eligible' | 'already-beaten' | 'low-contribution' | 'rested-out' | 'already-done' | 'bad-event';
export type Award = { state: CareerState; cp: number; reason: Reason; levelBefore: number; levelAfter: number };

// ---------------------------------------------------------------------------------------------------------------------------------
// The one entry point.

const finiteState = (s: CareerState): boolean =>
  [s.credit, s.pitWins, s.rested, s.restedAt, s.pit.rung].every(Number.isFinite)
  && Object.values(s.heat).every(h => Number.isFinite(h.units) && Number.isFinite(h.at));

const clampElapsed = (from: number, to: number): number => Math.max(0, Math.floor(to) - Math.floor(from)); // clock never runs back

export function restedAvailable(state: CareerState, at: number): number {
  return Math.floor(refill(state, at) / DAY_S);
}
function refill(state: CareerState, at: number): number {
  return Math.min(RESTED_CAP_UNITS, state.rested + clampElapsed(state.restedAt, at) * RESTED_PER_DAY_CP);
}
export function heatAt(state: CareerState, kind: string, at: number): number {
  const h = own(state.heat, kind);
  return h ? Math.max(0, h.units - clampElapsed(h.at, at)) : 0;
}

export function award(state: CareerState, event: CareerEvent, cap: number = CAREER_MAX_LEVEL, types: TypeTable = TYPE_WEIGHTS): Award {
  const levelBefore = levelOfCredit(state.credit, cap);
  const done = (next: CareerState, cp: number, reason: Reason): Award => {
    const credit = next.credit + cp;
    // Last line of defence: nothing non-finite, negative or fractional ever enters state. If any rule above produced one, the event
    // is refused and the state is returned untouched.
    if (!Number.isSafeInteger(cp) || cp < 0 || !Number.isSafeInteger(credit) || !finiteState(next)) {
      return { state, cp: 0, reason: 'bad-event', levelBefore, levelAfter: levelBefore };
    }
    const levelAfter = levelOfCredit(credit, cap);
    // At the top every boss reopens: the beaten flags are cleared on arrival and none is kept while there.
    const beaten = allBossesOpen(levelAfter, cap) ? [] : next.beaten;
    return { state: { ...next, credit, beaten }, cp, reason, levelBefore, levelAfter };
  };
  if (!event || typeof event.id !== 'string' || !Number.isFinite(event.at)) return done(state, 0, 'bad-event');

  switch (event.kind) {
    case 'arena-win': {
      // The verifier has already replayed the record (src/awards.ts). A first win over this opponent at your level pays the legend row
      // at even level; a legend already beaten pays nothing (a re-fight).
      const row = own(types, 'legend');
      if (!row || typeof event.opponent !== 'string' || event.opponent === '' || event.opponent.includes('@')) return done(state, 0, 'bad-event');
      const key = legendKey(event.opponent, levelBefore);
      if (state.beaten.includes(key)) return done(state, 0, 'already-beaten');
      const cp = basePay(row, levelBefore, levelBefore);
      return done({ ...state, pit: { rung: levelBefore }, pitWins: state.pitWins + 1, beaten: [...state.beaten, key] }, cp, 'ok');
    }

    case 'story': {
      const row = own(types, event.type);
      if (!row?.atOwn || typeof event.step !== 'string' || event.step === '') return done(state, 0, 'bad-event');
      if (state.story.includes(event.step)) return done(state, 0, 'already-done');
      return done({ ...state, story: [...state.story, event.step] }, basePay(row, levelBefore, levelBefore), 'ok');
    }

    case 'kill': {
      const row = own(types, event.type);
      const others = event.partyLevels ?? [];
      if (!row || row.atOwn || (row.party === 'solo' && others.length > 0) || typeof event.target !== 'string' || event.target === ''
        || others.length + 1 > MAX_PARTY || !Number.isInteger(event.targetLevel) || event.targetLevel < 1
        || !others.every(Number.isInteger)) return done(state, 0, 'bad-event');
      const highest = Math.max(levelBefore, ...others);
      const key = `${event.type}:${event.target}`;
      if (row.once && state.beaten.includes(key)) return done(state, 0, 'already-beaten');

      if (row.party === 'each') {
        if (!partyEligible(levelBefore, highest)) return done(state, 0, 'not-eligible');
        if (!((event.contributionPermille ?? 0) >= MIN_CONTRIBUTION_PERMILLE)) return done(state, 0, 'low-contribution');
      } else if (row.party === 'split' && others.length > 0 && (event.present === false || !partyEligible(levelBefore, highest))) {
        return done(state, 0, 'not-eligible');
      }
      // The colour is the HIGHEST member's for split rows (EverQuest): a high-level carry turns the kill grey for everyone.
      const you = row.party === 'split' ? highest : levelBefore;
      let cp = basePay(row, event.targetLevel, you);
      if (row.party === 'split') cp = Math.floor((cp * partySharePermille(others.length + 1)) / 1000);
      let next: CareerState = state;
      let reason: Reason = 'ok';
      if (row.rested) {
        // Heat is charged on every kill of the kind, paid or not: farming a grey kind still warms it.
        const at = Math.floor(event.at);
        const h = heatAt(state, event.target, at);
        const heatClock = Math.max(at, own(state.heat, event.target)?.at ?? at); // a late-arriving event never rewinds a clock
        const rested = refill(state, at);
        const raw = Math.floor((cp * repeatPermille(heatKills(h))) / 1000);
        cp = Math.min(raw, Math.floor(rested / DAY_S));
        reason = cp === 0 && raw > 0 ? 'rested-out' : 'ok';
        next = {
          ...state, heat: { ...state.heat, [event.target]: { units: h + HEAT_UNIT_S, at: heatClock } },
          rested: rested - cp * DAY_S, restedAt: Math.max(at, state.restedAt),
        };
      }
      if (isGrey(event.targetLevel - you)) return done(next, 0, 'grey'); // a grey kill does not use a boss up
      if (row.once) next = { ...next, beaten: [...next.beaten, key] };
      return done(next, cp, reason);
    }
  }
  return done(state, 0, 'bad-event');
}

// Settle a list in order, with the server's one-settlement-per-event-id index modelled by `settled` (pass the same Set across calls
// to model retries arriving later). A repeated id pays nothing and changes nothing.
export function settleAll(
  state: CareerState, events: readonly CareerEvent[], settled: Set<string> = new Set(), cap: number = CAREER_MAX_LEVEL,
  types: TypeTable = TYPE_WEIGHTS,
): { state: CareerState; awards: Award[] } {
  const awards: Award[] = [];
  let s = state;
  for (const e of events) {
    if (settled.has(e.id)) {
      const level = levelOfCredit(s.credit, cap);
      awards.push({ state: s, cp: 0, reason: 'duplicate', levelBefore: level, levelAfter: level });
      continue;
    }
    const a = award(s, e, cap, types);
    if (a.reason !== 'bad-event') settled.add(e.id);
    awards.push(a);
    s = a.state;
  }
  return { state: s, awards };
}
