// Frankendom: Origins — the ONE career (Dom's ruling 7), reference model. Pure, integer-only, not under src/.
// Its one import is the ladder itself (src/career.ts: MAX_LEVEL, RANK_STEPS), so the cap is never declared twice.
//
// Spec: docs/specs/origins/progression-proposal.md (this file is its executable half; the numbers below are the proposal's numbers
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

import { MAX_LEVEL, RANK_STEPS } from '../../src/career.ts';
export { MAX_LEVEL };

// The requirement curve. requirement(L) = REQ_BASE + REQ_STEP·(L − 1) + REQ_CURVE·max(0, L − REQ_KNEE)², integer for every L.
// Level 1 → 2 costs 1,000; level 10 → 11 costs 1,900 (gentle); from Gladiator I (level 11) a square term is added, so level 49 → 50
// costs 43,825. The curve never reads the cap: the cap only says where the ladder stops, so 46 and 50 share every row.
export const REQ_BASE = 1000;
export const REQ_STEP = 100;
export const REQ_KNEE = 10;
export const REQ_CURVE = 25;

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
export type TypeRow = {
  weight: number; once: boolean; rested: boolean; party: 'split' | 'each' | 'solo'; atOwn?: boolean;
};
export type TypeTable = Readonly<Record<string, TypeRow>>;
export const TYPE_WEIGHTS: TypeTable = {
  legend: { weight: 100, once: true, rested: false, party: 'solo' }, // a Pit legend: a tenth of a level at even level, to Gladiator I
  'world-boss': { weight: 500, once: true, rested: false, party: 'each' }, // half a level to 10; a fifth at 24; an eighth at 41
  named: { weight: 200, once: false, rested: true, party: 'split' },
  elite: { weight: 80, once: false, rested: true, party: 'split' },
  mob: { weight: 20, once: false, rested: true, party: 'split' },
  'story-step': { weight: 100, once: true, rested: false, party: 'solo', atOwn: true },
  'story-chapter': { weight: 500, once: true, rested: false, party: 'solo', atOwn: true },
};
export const isType = (types: TypeTable, t: unknown): t is string => typeof t === 'string' && own(types, t) !== undefined;

// Level-difference falloff, permille, by d = target level − your level. CAP-INDEPENDENT by construction: it reads only the
// difference d, never an absolute level. The one ladder fact it uses is the title width (src/career.ts RANK_STEPS, five sub-ranks a
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
// An 'each' row (a boss) pays a member only for a real share of the fight.
export const MIN_CONTRIBUTION_PERMILLE = 100; // ≥ 10% of the boss's health dealt (or the server's equivalent share)

// Repeat-kill heat, per character per target KIND (definition id, not spawn instance), for rested rows. Each kill adds one unit
// (HEAT_UNIT_S seconds of heat); heat drains one second per second, so a kind cools fully six minutes after one kill. Before a kill
// the heat is read as h = CEIL(units / HEAT_UNIT_S): any heat left over from a kill still counts as that whole kill, so the first
// FREE_REPEATS kills of a kind pay in full and the next one is reduced whenever kills come closer than six minutes apart. After that
// the kill pays FREE_REPEATS / (h + 1).
export const HEAT_UNIT_S = 360;
export const FREE_REPEATS = 3;
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
export const RESTED_PER_DAY_CP = 1500;
export const RESTED_CAP_CP = 3000;
const RESTED_CAP_UNITS = RESTED_CAP_CP * DAY_S;

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
// The value of one even-level kill at weight 1000: the curve's linear part. Equal to requirement(L) to level 10, behind it from 11.
export const killValue = (level: number): number => REQ_BASE + REQ_STEP * (wholeLevel(level) - 1);
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
// The top level reopens every boss (Dom, 2026-10-06): reaching the cap clears the beaten flags, and while at the cap none is kept.
export const allBossesOpen = (level: number, cap: number = MAX_LEVEL): boolean => wholeLevel(level) >= cap;

// The one pay rule. target = the target's level (ignored for atOwn rows); you = your level before the event.
export function basePay(row: TypeRow, target: number, you: number): number {
  if (row.atOwn) return Math.floor((killValue(you) * row.weight) / 1000);
  return Math.floor((killValue(Math.min(target, you)) * falloffPermille(target - you) * row.weight) / 1e6);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The Pit (proposal §3, for the arena Lead after the beta). A Pit fight is fought at your own level (the live dial), against one of the
// opponents; each opponent at each level is one legend, a 'legend' row: it pays its first win only. The model never counts legends:
// the server says who was beaten, and the key is opponent@level. `pit.rung` is the level the Pit last fought at (display, and the
// migration's resume point); it is never above the career level.
export type PitState = { rung: number };
export const legendKey = (opponent: string, level: number): string => `legend:${opponent}@${wholeLevel(level)}`;
// The next opponent: one not yet beaten at your level, picked by `key` the way src/ladder.ts nextOpponent picks from the pass today
// (key = a hash of the profile and its Pit wins, so the HUD and the Next button agree). null when every opponent at this level is
// beaten: the Pit then waits for the world to raise your level (or, at the top, every legend is open again).
export function nextLegend(state: CareerState, opponents: readonly string[], key: number, cap: number = MAX_LEVEL): string | null {
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

// A new or migrated character: credit to its exact live level, the Pit resumed at that same level, nothing beaten yet (the live ladder
// re-offers opponents today, so there is no beaten-once record to carry over), a full allowance.
export const newCareer = (marks = 0, at = 0, cap: number = MAX_LEVEL): CareerState => ({
  credit: creditFromMarks(marks, cap), pit: { rung: levelOfMarks(marks, cap) },
  pitWins: Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0, rested: RESTED_CAP_UNITS, restedAt: at,
  heat: {}, beaten: [], story: [],
});

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

export function award(state: CareerState, event: CareerEvent, cap: number = MAX_LEVEL, types: TypeTable = TYPE_WEIGHTS): Award {
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
  state: CareerState, events: readonly CareerEvent[], settled: Set<string> = new Set(), cap: number = MAX_LEVEL,
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
