// Frankendom: Origins — the ONE career (Dom's ruling 7), reference model. Pure, integer-only, not under src/.
// Its one import is the ladder itself (src/career.ts: MAX_LEVEL, RANK_STEPS), so the cap is never declared twice.
//
// Spec: docs/specs/origins/progression-proposal.md (this file is its executable half; the numbers below are the proposal's numbers
// and every one is pinned in model.test.ts). Clean room (ruling 8): written from the specs in docs/specs/origins/ only.
//
// The whole idea in one line: the career is a single integer, CAREER CREDIT, counted in credit points (CP). One Pit win is exactly
// 1000 CP, so `level = min(cap, 1 + floor(credit / 1000))` is today's `level = min(cap, 1 + wins)` for every existing account (cap = the
// ladder cap, src/career.ts MAX_LEVEL: 46 today, 50 after Dom's 2026-10-05 ruling, with the top rank becoming Origin I–V). World
// bosses pay up to 1000 CP; ordinary mobs pay tens of CP, less for creatures below you, less again on repeats, and only while the
// character's rested allowance lasts. Credit only ever goes up.
//
// Server use: the authoritative world server (or the verifier, for Pit wins) calls `award(state, event)` once per verified event,
// with the server clock. The function never reads a clock, a random number or a device value; the same state and event give the same
// award on every sweep, so a retried settlement can be checked byte for byte.

// ---------------------------------------------------------------------------------------------------------------------------------
// Constants (the proposal's table; change them only with the doc).

import { MAX_LEVEL, RANK_STEPS } from '../../src/career.ts';
export { MAX_LEVEL };

export const CP_PER_MARK = 1000; // one Pit win = one mark = one career level
export const ARENA_WIN_CP = 1000;
export const BOSS_CP = 1000; // "a world boss kill counts like an arena win"; never more
export const MOB_BASE_CP = { ordinary: 20, elite: 80, named: 200 } as const;
export type MobClass = keyof typeof MOB_BASE_CP;
export const PER_KILL_CAP_CP = 250; // no single non-boss kill pays more than a quarter level

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
// heat); heat drains one second per second, so a kind cools fully six minutes after one kill. The first FREE_REPEATS kills inside the
// heat pay in full; after that the kill pays FREE_REPEATS / (h + 1).
export const HEAT_UNIT_S = 360;
export const FREE_REPEATS = 3;
export function repeatPermille(heatUnits: number): number {
  const h = Math.max(0, Math.floor(heatUnits));
  return h < FREE_REPEATS ? 1000 : Math.floor((FREE_REPEATS * 1000) / (h + 1));
}

// Rested allowance (WoW's rested pool, turned into the ceiling): ordinary/elite/named credit is paid out of a pool that refills at
// RESTED_PER_DAY_CP and holds at most RESTED_CAP_CP. Empty pool: the kill still drops loot and counts for quests, but pays 0 CP.
// Pit wins, bosses and story never touch the pool. Stored scaled by DAY_S so the refill is exact in integers.
export const DAY_S = 86_400;
export const RESTED_PER_DAY_CP = 1500;
export const RESTED_CAP_CP = 3000;
const RESTED_CAP_UNITS = RESTED_CAP_CP * DAY_S;

// Boss lockout: a given boss pays a given character once per rolling 7 days, and the member must have done real work in the kill.
export const BOSS_LOCKOUT_S = 7 * DAY_S;
export const BOSS_MIN_CONTRIBUTION_PERMILLE = 100; // ≥ 10% of the boss's health dealt (or the server's equivalent share)

// ---------------------------------------------------------------------------------------------------------------------------------
// Levels. Today's ladder, read from credit. Every level function takes the ladder cap, defaulting to src/career.ts MAX_LEVEL, so the
// model follows the arena's cap change (46 → 50) without an edit here and tests can run both ladders.

export const levelOfCredit = (credit: number, cap: number = MAX_LEVEL): number =>
  Math.min(cap, 1 + (Number.isFinite(credit) ? Math.max(0, Math.floor(credit / CP_PER_MARK)) : 0));
// The migration: an account's server marks become credit 1:1000, so its level is unchanged.
export const creditFromMarks = (marks: number): number => (Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0) * CP_PER_MARK;
// The rank bar's partial fill (src/career.ts Rank.fill, kept at 0 today "so the bar code reads unchanged"), permille of a level.
export const fillPermille = (credit: number, cap: number = MAX_LEVEL): number =>
  (levelOfCredit(credit, cap) === cap ? 0 : Math.floor(credit) % CP_PER_MARK);

// ---------------------------------------------------------------------------------------------------------------------------------
// State and events.

export type Heat = { units: number; at: number }; // units in seconds of heat, at = server seconds of the last update
export type CareerState = {
  credit: number; // CP, integer, never decreases
  pitWins: number; // display only (the Pit board); not used for rank
  rested: number; // CP × DAY_S
  restedAt: number; // server seconds of the last rested update
  heat: Readonly<Record<string, Heat>>; // by mob kind
  bossAt: Readonly<Record<string, number>>; // by boss id: server seconds of the last CREDITED kill
  story: readonly string[]; // story step ids already credited
};
// Event ids already settled are NOT career state: they are the server's unique index (loot_claims.fight_hash today; an encounter id
// for world kills). `settleAll` models that index with a Set so a retried event pays nothing.

export const newCareer = (marks = 0, at = 0): CareerState => ({
  credit: creditFromMarks(marks), pitWins: Math.max(0, Math.floor(marks) || 0), rested: RESTED_CAP_UNITS, restedAt: at,
  heat: {}, bossAt: {}, story: [],
});

// Every event has an id the server made (fight hash, encounter id, story step) and a server time in whole seconds.
export type ArenaWin = { kind: 'arena-win'; id: string; at: number };
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

// Story credit is content data, bounded here so a typo cannot mint a rank: one step pays at most one mark, once ever.
export const STORY_MAX_CP = 1000;

// ---------------------------------------------------------------------------------------------------------------------------------
// The one entry point.

const clampElapsed = (from: number, to: number): number => Math.max(0, Math.floor(to) - Math.floor(from)); // clock never runs back

export function restedAvailable(state: CareerState, at: number): number {
  return Math.floor(refill(state, at) / DAY_S);
}
function refill(state: CareerState, at: number): number {
  return Math.min(RESTED_CAP_UNITS, state.rested + clampElapsed(state.restedAt, at) * RESTED_PER_DAY_CP);
}
export function heatAt(state: CareerState, mob: string, at: number): number {
  const h = state.heat[mob];
  return h ? Math.max(0, h.units - clampElapsed(h.at, at)) : 0;
}

export function award(state: CareerState, event: CareerEvent, cap: number = MAX_LEVEL): Award {
  const levelBefore = levelOfCredit(state.credit, cap);
  const done = (next: CareerState, cp: number, reason: Reason): Award => {
    const credit = next.credit + cp;
    return { state: { ...next, credit }, cp, reason, levelBefore, levelAfter: levelOfCredit(credit, cap) };
  };
  if (!event || typeof event.id !== 'string' || !Number.isFinite(event.at)) return done(state, 0, 'bad-event');

  switch (event.kind) {
    case 'arena-win':
      // Unchanged Pit rule: the verifier has already replayed the record and applied the dial floor (src/awards.ts levelRefusal).
      return done({ ...state, pitWins: state.pitWins + 1 }, ARENA_WIN_CP, 'ok');

    case 'story': {
      if (!Number.isInteger(event.cp) || event.cp < 0 || event.cp > STORY_MAX_CP) return done(state, 0, 'bad-event');
      if (state.story.includes(event.step)) return done(state, 0, 'already-done');
      return done({ ...state, story: [...state.story, event.step] }, event.cp, 'ok');
    }

    case 'boss': {
      const others = event.partyLevels ?? [];
      if (others.length + 1 > MAX_PARTY || !Number.isInteger(event.bossLevel)) return done(state, 0, 'bad-event');
      const highest = Math.max(levelBefore, ...others);
      if (!partyEligible(levelBefore, highest)) return done(state, 0, 'not-eligible');
      if (!(event.contributionPermille >= BOSS_MIN_CONTRIBUTION_PERMILLE)) return done(state, 0, 'low-contribution');
      const last = state.bossAt[event.boss];
      if (last !== undefined && clampElapsed(last, event.at) < BOSS_LOCKOUT_S) return done(state, 0, 'locked-out');
      // A boss pays like a Pit win: its own falloff below you, never a bonus above (no rank inflation from over-level bosses).
      const cp = Math.floor((BOSS_CP * Math.min(1000, falloffPermille(event.bossLevel - levelBefore))) / 1000);
      if (cp === 0) return done(state, 0, 'grey'); // a grey boss does not start the lockout
      return done({ ...state, bossAt: { ...state.bossAt, [event.boss]: Math.floor(event.at) } }, cp, 'ok');
    }

    case 'mob': {
      const others = event.partyLevels ?? [];
      const base = MOB_BASE_CP[event.mobClass];
      if (base === undefined || others.length + 1 > MAX_PARTY || !Number.isInteger(event.mobLevel)) return done(state, 0, 'bad-event');
      const highest = Math.max(levelBefore, ...others);
      if (others.length > 0 && (event.present === false || !partyEligible(levelBefore, highest))) return done(state, 0, 'not-eligible');
      // Heat is charged on every kill of the kind, paid or not: farming a grey kind still warms it.
      const at = Math.floor(event.at);
      const h = heatAt(state, event.mob, at);
      const heatClock = Math.max(at, state.heat[event.mob]?.at ?? at); // a late-arriving event never rewinds a clock
      const heat = { ...state.heat, [event.mob]: { units: h + HEAT_UNIT_S, at: heatClock } };
      const rested = refill(state, at);
      // The colour is the HIGHEST member's (EverQuest): a high-level carry turns the mob grey for everyone.
      const fall = falloffPermille(event.mobLevel - highest);
      const raw = Math.min(
        PER_KILL_CAP_CP,
        Math.floor((base * fall * partySharePermille(others.length + 1) * repeatPermille(Math.floor(h / HEAT_UNIT_S))) / 1e9),
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
