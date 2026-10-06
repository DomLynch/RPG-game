// Frankendom: Origins — the ONE career (Dom's ruling 7), reference model. Pure, integer-only, not under src/.
// Its one import is the ladder itself (src/career.ts: MAX_LEVEL, RANK_STEPS), so the cap is never declared twice.
//
// Spec: docs/specs/origins/progression-proposal.md (this file is its executable half; the numbers below are the proposal's numbers
// and every one is pinned in model.test.ts). Clean room (ruling 8): written from the specs in docs/specs/origins/ only.
//
// The whole idea: the career is a single integer, CAREER CREDIT, counted in credit points (CP). The level is read from credit
// through a RISING requirement curve (`requirement(L)` CP to go from L to L + 1: gentle to level 10, steeper from Gladiator, level 11,
// on). Rank, title and gates read that one level. The Pit is its own ladder that the character resumes: a Pit rung and the set of
// legends beaten; each legend can be beaten once, and a Pit win pays the requirement AT THE PIT RUNG, so a win is one level at your
// Pit rank. World bosses pay the requirement at their own level (at most yours); creatures pay small fixed CP out of a rested
// allowance, so as the requirement rises they become a smaller and smaller part of a level. Credit only ever goes up.
//
// Server use: the authoritative world server (or the verifier, for Pit wins) calls `award(state, event)` once per verified event,
// with the server clock. The function never reads a clock, a random number or a device value; the same state and event give the same
// award on every sweep, so a retried settlement can be checked byte for byte.

// ---------------------------------------------------------------------------------------------------------------------------------
// Constants (the proposal's table; change them only with the doc).

import { MAX_LEVEL, RANK_STEPS } from '../../src/career.ts';
export { MAX_LEVEL };

// The requirement curve. requirement(L) = REQ_BASE + REQ_STEP·(L − 1) + REQ_CURVE·max(0, L − REQ_KNEE)², integer for every L.
// Level 1 → 2 costs 1,000; level 10 → 11 costs 1,900 (gentle); from Gladiator I (level 11) a square term is added, so level 45 → 46
// costs 36,025. The curve never reads the cap: the cap only says where the ladder stops, so 46 and 50 share every row.
export const REQ_BASE = 1000;
export const REQ_STEP = 100;
export const REQ_KNEE = 10;
export const REQ_CURVE = 25;
export const MOB_BASE_CP = { ordinary: 20, elite: 80, named: 200 } as const;
export type MobClass = keyof typeof MOB_BASE_CP;
export const PER_KILL_CAP_CP = 250; // no single non-boss kill pays more than this, at any level
// Every keyed lookup that takes a string from an event (mob class, mob kind, boss id) goes through `own`, so a key such as
// 'toString', 'constructor' or '__proto__' reads as absent instead of finding something on Object.prototype.
const own = <T>(rec: Readonly<Record<string, T>>, key: string): T | undefined =>
  (Object.hasOwn(rec, key) ? rec[key] : undefined);
export const isMobClass = (c: unknown): c is MobClass => typeof c === 'string' && Object.hasOwn(MOB_BASE_CP, c);

// Level-difference falloff, permille, by d = target level − reference level. CAP-INDEPENDENT by construction: it reads only the
// difference d, never an absolute level, so moving the cap from 46 to 50 changes no band. The one ladder fact it uses is the title
// width (src/career.ts RANK_STEPS, five sub-ranks a title, unchanged by the 50-level ruling): exactly one title below you pays a fifth,
// and a creature more than a whole title below you is grey and pays nothing.
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

// Party share for ordinary/elite/named kills (EverQuest's group shape): pool = X·(1 + g/2), g = 1 + 0.2·(n−1); each member gets pool/n.
export const MAX_PARTY = 4;
export function partySharePermille(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTY) return 0;
  if (n === 1) return 1000;
  const g = 1000 + 200 * (n - 1);
  return Math.floor((1000 + g / 2) / n); // n=2 800, n=3 566, n=4 450
}
// A member is eligible for party credit only if within the level gap of the party's highest member: gap ≤ max(5, floor(L/2)).
export const partyEligible = (memberLevel: number, highestLevel: number): boolean =>
  highestLevel - memberLevel <= Math.max(5, Math.floor(memberLevel / 2));

// Repeat-kill heat, per character per mob KIND (definition id, not spawn instance). Each kill adds one unit (HEAT_UNIT_S seconds of
// heat); heat drains one second per second, so a kind cools fully six minutes after one kill. Before a kill the heat is read as
// h = CEIL(units / HEAT_UNIT_S): any heat left over from a kill still counts as that whole kill, so the first FREE_REPEATS kills of a
// kind pay in full and the next one is reduced whenever kills come closer than six minutes apart. After that the kill pays
// FREE_REPEATS / (h + 1).
export const HEAT_UNIT_S = 360;
export const FREE_REPEATS = 3;
export const heatKills = (units: number): number => Math.max(0, Math.ceil(units / HEAT_UNIT_S));
export function repeatPermille(heatUnits: number): number {
  const h = Math.max(0, Math.floor(heatUnits));
  return h < FREE_REPEATS ? 1000 : Math.floor((FREE_REPEATS * 1000) / (h + 1));
}

// Rested allowance (WoW's rested pool, turned into the ceiling): ordinary/elite/named credit is paid out of a pool that refills at
// RESTED_PER_DAY_CP and holds at most RESTED_CAP_CP. Empty pool: the kill still drops loot and counts for quests, but pays 0 CP.
// Pit wins, bosses and story never touch the pool. Stored scaled by DAY_S so the refill is exact in integers. Fixed in CP at every
// level (decided, Dom 2026-10-06): as the requirement rises, a day's allowance is a shrinking part of a level.
export const DAY_S = 86_400;
export const RESTED_PER_DAY_CP = 1500;
export const RESTED_CAP_CP = 3000;
const RESTED_CAP_UNITS = RESTED_CAP_CP * DAY_S;

// Boss lockout: a given boss pays a given character once per rolling 7 days, and the member must have done real work in the kill.
export const BOSS_LOCKOUT_S = 7 * DAY_S;
export const BOSS_MIN_CONTRIBUTION_PERMILLE = 100; // ≥ 10% of the boss's health dealt (or the server's equivalent share)

// ---------------------------------------------------------------------------------------------------------------------------------
// Levels. Every level function takes the ladder cap, defaulting to src/career.ts MAX_LEVEL, so the model follows the arena's cap
// change (46 → 50) without an edit here and tests can run both ladders.

const wholeLevel = (level: number): number => (Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1);
// CP to go from level L to L + 1.
export const requirement = (level: number): number => {
  const l = wholeLevel(level);
  const over = Math.max(0, l - REQ_KNEE);
  return REQ_BASE + REQ_STEP * (l - 1) + REQ_CURVE * over * over;
};
// CP to reach level L from nothing: the sum of requirement(1..L−1). Closed form, integer (each product below is divisible as noted).
export const cumulative = (level: number): number => {
  const k = wholeLevel(level) - 1; // levels climbed
  const linear = REQ_BASE * k + (REQ_STEP * k * (k - 1)) / 2; // k(k−1) is even
  const m = Math.max(0, k - REQ_KNEE); // squared terms paid: (1² + … + m²)
  return linear + (REQ_CURVE * m * (m + 1) * (2 * m + 1)) / 6; // m(m+1)(2m+1) is divisible by 6
};
// WHAT DRIVES RANK: this, and only this. Title, sub-rank, gates and the rank bar all read levelOfCredit(credit, cap).
export function levelOfCredit(credit: number, cap: number = MAX_LEVEL): number {
  if (!Number.isFinite(credit) || credit <= 0) return 1;
  let level = 1;
  while (level < cap && cumulative(level + 1) <= credit) level++;
  return level;
}
// Today's rule, at any cap: src/career.ts levelOf(marks) = min(MAX_LEVEL, 1 + wins).
export const levelOfMarks = (marks: number, cap: number = MAX_LEVEL): number =>
  Math.min(cap, 1 + (Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0));
// The migration: a live account keeps its exact level. Its credit is the cumulative requirement to reach levelOf(marks).
export const creditFromMarks = (marks: number, cap: number = MAX_LEVEL): number => cumulative(levelOfMarks(marks, cap));
// The rank bar's partial fill (src/career.ts Rank.fill, kept at 0 today "so the bar code reads unchanged"), permille of the level.
export function fillPermille(credit: number, cap: number = MAX_LEVEL): number {
  const level = levelOfCredit(credit, cap);
  if (level === cap) return 0;
  return Math.floor(((Math.floor(credit) - cumulative(level)) * 1000) / requirement(level));
}
// The title tier (1..10) of a level: five sub-ranks a title, Origin (tier 10) from level 46 on.
export const tierOf = (level: number): number => Math.min(10, Math.floor((wholeLevel(level) - 1) / RANK_STEPS) + 1);

// ---------------------------------------------------------------------------------------------------------------------------------
// The Pit ladder (proposal §7, for the arena Lead after the beta). The Pit has its own position that the character resumes: the rung
// (the level the Pit fights at) and the legends beaten. A legend is an opponent at a title tier (src/legends.ts: ten opponents, a legend
// each at each of the ten tiers). One win per rung, so five legends per title, ~45 named fights to Origin. Each legend is beaten ONCE: a
// loss is a retry, a win retires that legend for this character. At the top rung the Pit's opponents are mass-produced, not legends.
// The Pit rung only picks the opponent; rank is the career level above. Pit credit alone reaches exactly the rung's level, so the
// career level is never below the Pit rung.

export type PitState = { rung: number; beaten: readonly string[] };
export const legendKey = (opponent: string, tier: number): string => `${opponent}@${tier}`;
// The next opponent at the character's current rung: an unbeaten legend of the rung's tier, picked by `key` the way src/ladder.ts
// nextOpponent picks from the pass today (key = a hash of the profile and its Pit wins, so the HUD and the Next button agree). null at
// the top rung (mass-produced opponents) or if the tier has no unbeaten legend left.
export function nextLegend(pit: PitState, opponents: readonly string[], key: number, cap: number = MAX_LEVEL): string | null {
  if (pit.rung >= cap) return null;
  const tier = tierOf(pit.rung);
  const left = opponents.filter(o => !pit.beaten.includes(legendKey(o, tier)));
  return left.length ? left[(key >>> 0) % left.length] : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// State and events.

export type Heat = { units: number; at: number }; // units in seconds of heat, at = server seconds of the last update
export type CareerState = {
  credit: number; // CP, integer, never decreases
  pit: PitState; // the Pit's own ladder: picks the opponent, never the rank
  pitWins: number; // display only (the Pit board); not used for rank
  rested: number; // CP × DAY_S
  restedAt: number; // server seconds of the last rested update
  heat: Readonly<Record<string, Heat>>; // by mob kind
  bossAt: Readonly<Record<string, number>>; // by boss id: server seconds of the last CREDITED kill
  story: readonly string[]; // story step ids already credited
};
// Event ids already settled are NOT career state: they are the server's unique index (loot_claims.fight_hash today; an encounter id
// for world kills). `settleAll` models that index with a Set so a retried event pays nothing.

// A new or migrated character: credit to its exact live level, the Pit resumed at that same level, no legend beaten yet (the live
// ladder re-offers opponents today, so there is no beaten-once record to carry over), a full allowance.
export const newCareer = (marks = 0, at = 0, cap: number = MAX_LEVEL): CareerState => ({
  credit: creditFromMarks(marks, cap), pit: { rung: levelOfMarks(marks, cap), beaten: [] },
  pitWins: Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0, rested: RESTED_CAP_UNITS, restedAt: at,
  heat: {}, bossAt: {}, story: [],
});

// Every event has an id the server made (fight hash, encounter id, story step) and a server time in whole seconds.
export type ArenaWin = { kind: 'arena-win'; id: string; at: number; opponent: string }; // the opponent the server says was beaten
export type MobKill = {
  kind: 'mob'; id: string; at: number;
  mob: string; // mob definition id: the repeat key
  mobClass: MobClass; mobLevel: number;
  partyLevels?: readonly number[]; // the OTHER members' career levels at engage (server roster); absent = solo
  present?: boolean; // party member was in range and engaged (server); solo killers are present by definition
};
export type BossKill = {
  kind: 'boss'; id: string; at: number;
  boss: string; bossLevel: number;
  partyLevels?: readonly number[];
  contributionPermille: number; // this member's verified share of the fight (server)
};
export type StoryStep = { kind: 'story'; id: string; at: number; step: string; cp: number };
export type CareerEvent = ArenaWin | MobKill | BossKill | StoryStep;

export type Reason =
  | 'ok' | 'duplicate' | 'grey' | 'not-eligible' | 'locked-out' | 'low-contribution' | 'rested-out' | 'already-done' | 'bad-event';
export type Award = { state: CareerState; cp: number; reason: Reason; levelBefore: number; levelAfter: number };

// Story credit is content data (decided, Dom 2026-10-06: 100 a step, 500 a chapter, once ever), bounded here so a typo cannot mint a
// rank: one step pays at most STORY_MAX_CP.
export const STORY_MAX_CP = 1000;

// ---------------------------------------------------------------------------------------------------------------------------------
// The one entry point.

const finiteState = (s: CareerState): boolean =>
  [s.credit, s.pitWins, s.rested, s.restedAt, s.pit.rung].every(Number.isFinite)
  && Object.values(s.heat).every(h => Number.isFinite(h.units) && Number.isFinite(h.at))
  && Object.values(s.bossAt).every(Number.isFinite);

const clampElapsed = (from: number, to: number): number => Math.max(0, Math.floor(to) - Math.floor(from)); // clock never runs back

export function restedAvailable(state: CareerState, at: number): number {
  return Math.floor(refill(state, at) / DAY_S);
}
function refill(state: CareerState, at: number): number {
  return Math.min(RESTED_CAP_UNITS, state.rested + clampElapsed(state.restedAt, at) * RESTED_PER_DAY_CP);
}
export function heatAt(state: CareerState, mob: string, at: number): number {
  const h = own(state.heat, mob);
  return h ? Math.max(0, h.units - clampElapsed(h.at, at)) : 0;
}

export function award(state: CareerState, event: CareerEvent, cap: number = MAX_LEVEL): Award {
  const levelBefore = levelOfCredit(state.credit, cap);
  const done = (next: CareerState, cp: number, reason: Reason): Award => {
    const credit = next.credit + cp;
    // Last line of defence: nothing non-finite, negative or fractional ever enters state. If any rule above produced one, the event
    // is refused and the state is returned untouched.
    if (!Number.isSafeInteger(cp) || cp < 0 || !Number.isSafeInteger(credit) || !finiteState(next)) {
      return { state, cp: 0, reason: 'bad-event', levelBefore, levelAfter: levelBefore };
    }
    return { state: { ...next, credit }, cp, reason, levelBefore, levelAfter: levelOfCredit(credit, cap) };
  };
  if (!event || typeof event.id !== 'string' || !Number.isFinite(event.at)) return done(state, 0, 'bad-event');

  switch (event.kind) {
    case 'arena-win': {
      // The verifier has already replayed the record (src/awards.ts). The win pays one level AT THE PIT RUNG and moves the rung up
      // one; below the top rung it retires the legend beaten, and a legend already retired for this character pays nothing.
      const rung = Math.min(cap, Math.max(1, Math.floor(state.pit.rung)));
      const cp = requirement(rung);
      if (rung >= cap) return done({ ...state, pitWins: state.pitWins + 1 }, cp, 'ok'); // mass-produced opponents at the top
      if (typeof event.opponent !== 'string' || event.opponent === '' || event.opponent.includes('@')) return done(state, 0, 'bad-event');
      const legend = legendKey(event.opponent, tierOf(rung));
      if (state.pit.beaten.includes(legend)) return done(state, 0, 'already-done');
      const pit = { rung: rung + 1, beaten: [...state.pit.beaten, legend] };
      return done({ ...state, pit, pitWins: state.pitWins + 1 }, cp, 'ok');
    }

    case 'story': {
      if (!Number.isInteger(event.cp) || event.cp < 0 || event.cp > STORY_MAX_CP) return done(state, 0, 'bad-event');
      if (state.story.includes(event.step)) return done(state, 0, 'already-done');
      return done({ ...state, story: [...state.story, event.step] }, event.cp, 'ok');
    }

    case 'boss': {
      const others = event.partyLevels ?? [];
      if (others.length + 1 > MAX_PARTY || !Number.isInteger(event.bossLevel) || event.bossLevel < 1 || !others.every(Number.isInteger)
        || typeof event.boss !== 'string') return done(state, 0, 'bad-event');
      const highest = Math.max(levelBefore, ...others);
      if (!partyEligible(levelBefore, highest)) return done(state, 0, 'not-eligible');
      if (!(event.contributionPermille >= BOSS_MIN_CONTRIBUTION_PERMILLE)) return done(state, 0, 'low-contribution');
      const last = own(state.bossAt, event.boss);
      if (last !== undefined && clampElapsed(last, event.at) < BOSS_LOCKOUT_S) return done(state, 0, 'locked-out');
      // A boss pays one level at ITS level, never more than one of yours (no inflation from over-level bosses), with the falloff
      // below you exactly as for creatures.
      const fall = Math.min(1000, falloffPermille(event.bossLevel - levelBefore));
      const cp = Math.floor((requirement(Math.min(event.bossLevel, levelBefore)) * fall) / 1000);
      if (cp === 0) return done(state, 0, 'grey'); // a grey boss does not start the lockout
      return done({ ...state, bossAt: { ...state.bossAt, [event.boss]: Math.floor(event.at) } }, cp, 'ok');
    }

    case 'mob': {
      const others = event.partyLevels ?? [];
      if (!isMobClass(event.mobClass) || typeof event.mob !== 'string' || others.length + 1 > MAX_PARTY
        || !Number.isInteger(event.mobLevel) || !others.every(Number.isInteger)) return done(state, 0, 'bad-event');
      const base = MOB_BASE_CP[event.mobClass];
      const highest = Math.max(levelBefore, ...others);
      if (others.length > 0 && (event.present === false || !partyEligible(levelBefore, highest))) return done(state, 0, 'not-eligible');
      // Heat is charged on every kill of the kind, paid or not: farming a grey kind still warms it.
      const at = Math.floor(event.at);
      const h = heatAt(state, event.mob, at);
      const heatClock = Math.max(at, own(state.heat, event.mob)?.at ?? at); // a late-arriving event never rewinds a clock
      const heat = { ...state.heat, [event.mob]: { units: h + HEAT_UNIT_S, at: heatClock } };
      const rested = refill(state, at);
      // The colour is the HIGHEST member's (EverQuest): a high-level carry turns the mob grey for everyone.
      const fall = falloffPermille(event.mobLevel - highest);
      const raw = Math.min(
        PER_KILL_CAP_CP,
        Math.floor((base * fall * partySharePermille(others.length + 1) * repeatPermille(heatKills(h))) / 1e9),
      );
      const next = { ...state, heat, rested, restedAt: Math.max(at, state.restedAt) };
      if (fall === 0) return done(next, 0, 'grey');
      const cp = Math.min(raw, Math.floor(rested / DAY_S));
      const paid = { ...next, rested: rested - cp * DAY_S };
      return done(paid, cp, cp === 0 && raw > 0 ? 'rested-out' : 'ok');
    }
  }
  return done(state, 0, 'bad-event');
}

// Settle a list in order, with the server's one-settlement-per-event-id index modelled by `settled` (pass the same Set across calls
// to model retries arriving later). A repeated id pays nothing and changes nothing.
export function settleAll(
  state: CareerState, events: readonly CareerEvent[], settled: Set<string> = new Set(), cap: number = MAX_LEVEL,
): { state: CareerState; awards: Award[] } {
  const awards: Award[] = [];
  let s = state;
  for (const e of events) {
    if (settled.has(e.id)) {
      const level = levelOfCredit(s.credit, cap);
      awards.push({ state: s, cp: 0, reason: 'duplicate', levelBefore: level, levelAfter: level });
      continue;
    }
    const a = award(s, e, cap);
    if (a.reason !== 'bad-event') settled.add(e.id);
    awards.push(a);
    s = a.state;
  }
  return { state: s, awards };
}
