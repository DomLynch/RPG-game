// BASE (Lead, 2026-10-13): a world kill's record, replayed on the server through the world loop (src/fight/world-record.ts, the same stepHero the page ran) before anything spendable or permanent pays.
// Verified = the record decodes, its hero claims are inside the caps (and inside the server's own ledger when it has one), it replays without a bound broken, the hero kills THIS spawn, and that
// creature joined as the spawn's own kind and level inside its roam. Anything else is "unverified": the caller pays scorecard counts only. Never throws.
import { DEFAULT_WEAPON, MAX_WORLD_TICKS, decodeWorldRecord, hash32, replayWorldRecord } from '../../src/fight/server.ts';
import type { Sheet } from '../../src/fight/server.ts';
import { withinReach, type Spawn } from './world-spawns.ts';
import { checkSpell, type SpellHeld } from './spell-check.ts';
import { CM_PER_M, TICKS_PER_SECOND } from './units.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };
import { specialsRefusal, type SpecialsCut } from '../../src/core/server.ts';   // the beta cut on specials (career-ladder.ts), through the core's server door

export const MAX_RECORD_CHARS = 60_000;   // under the writer's 64 KB body limit
/** The most steps an engagement of this age (s) can hold, plus two seconds for the window that opened just before the token. */
export const ticksFor = (ageS: number): number => Math.floor(TICKS_PER_SECOND * (Number.isFinite(ageS) ? Math.max(0, ageS) : 0)) + SERVER_RULES.worldKill[0]!.windowSlackTicks;   // windowSlackTicks: a row of the worldKill table
export type HeroLimit = { level?: number; sheet?: Sheet; weapon?: string; spells?: SpellHeld; refuse?: string; cut?: SpecialsCut };   // cut: the beta cut on specials (src/awards.ts specialsRefusal); absent = the betaCut row, a test may pass a lifted one   // `sheet` present (even undefined) = the record's sheet must EQUAL it (heroLimitOf, the Pit's rule); `refuse` = the books could not give one; attack/res: the older Loadout bound   // what the server's own books allow him: a claim above it is refused (a limit with no level binds the gear only: the worn Loadout the ledger holds)
const sameSheet = (a: Sheet | undefined, b: Sheet | undefined): boolean => { const x = Object.entries(a ?? {}), y = b ?? {}; return x.length === Object.keys(y).length && x.every(([k, v]) => y[k] === v); };
export type Verdict = { ok: true; ticks: number } | { ok: false; reason: string };

/** What a replay needs, all plain data (it crosses to the worker thread). */
// Soak counters: kills by outcome ('verified', 'no record', or the refusal reason), so the verified rate is one read once the records are live.
// Each kill also counts in its cohort: 'qa' for the marked QA account (Strategy 2026-10-18: QA-driven kills count for the matrix soak), 'organic' for everyone else. Per cohort the tally keeps the
// outcomes of its first `firstKills` kills and the longest run of kills that were not `good` ('verified' for records, 'checked' for reach), which the strictRevert row reads. Memory stays bounded:
// the outcome keys are bounded by their callers (#3155), the first-kills list by the row.
export type Cohort = 'organic' | 'qa';
export type CohortCounts = { total: number; outcomes: Record<string, number>; first: { kills: number; good: number }; run: number; maxRun: number };
export type TallySnapshot = { since: string; total: number; verified: number; rate: number | null; outcomes: Record<string, number>; cohorts: Record<Cohort, CohortCounts> };
export type VerdictTally = { add(outcome: string, cohort?: Cohort): void; snapshot(): TallySnapshot };
export function createVerdictTally(now: () => Date = () => new Date(), good = 'verified', firstKills: number = SERVER_RULES.strictRevert[0]!.firstKills): VerdictTally {
  const since = now().toISOString(), outcomes: Record<string, number> = {};
  const fresh = (): CohortCounts => ({ total: 0, outcomes: {}, first: { kills: 0, good: 0 }, run: 0, maxRun: 0 }), cohorts: Record<Cohort, CohortCounts> = { organic: fresh(), qa: fresh() };
  return {
    add: (o, cohort = 'organic') => {
      outcomes[o] = (outcomes[o] ?? 0) + 1;
      const c = cohorts[cohort], ok = o === good;
      c.total++; c.outcomes[o] = (c.outcomes[o] ?? 0) + 1;
      if (c.first.kills < firstKills) { c.first.kills++; if (ok) c.first.good++; }
      c.run = ok ? 0 : c.run + 1; c.maxRun = Math.max(c.maxRun, c.run);
    },
    snapshot: () => {
      const total = Object.values(outcomes).reduce((a, b) => a + b, 0), verified = outcomes.verified ?? 0, copy = (c: CohortCounts): CohortCounts => ({ ...c, outcomes: { ...c.outcomes }, first: { ...c.first } });
      return { since, total, verified, rate: total ? verified / total : null, outcomes: { ...outcomes }, cohorts: { organic: copy(cohorts.organic), qa: copy(cohorts.qa) } };
    },
  };
}
// The revert rule after the strict flip (Strategy 2026-10-18, row strictRevert): judged on ORGANIC kills only, from the reach tally. Revert (Deploy flips both flags OFF, with a readout line on the
// thread) when the first `firstKills` organic kills are complete and fewer than `minRate` of them were checked, or as soon as `maxUncheckedRun` organic kills in a row were not checked. The counters
// start at the writer's restart, so after the flip-restart "the first 50" are the first 50 under the flags. Pure.
export type RevertCheck = { kills: number; rate: number | null; maxRun: number; revert: boolean; why: string | null };
export function strictRevert(organic: Pick<CohortCounts, 'first' | 'maxRun'>, rule: { firstKills: number; minRate: number; maxUncheckedRun: number } = SERVER_RULES.strictRevert[0]!): RevertCheck {
  const { kills, good } = organic.first, rate = kills ? good / kills : null;
  const why = organic.maxRun >= rule.maxUncheckedRun ? `${organic.maxRun} organic kills in a row unchecked` : kills >= rule.firstKills && rate !== null && rate < rule.minRate ? `first ${kills} organic kills: ${good} checked` : null;
  return { kills, rate, maxRun: organic.maxRun, revert: why !== null, why };
}
// The strict-flip readout (audit 2026-10-18; Strategy: both flags ON is a beta-opening gate): may ORIGINS_SPAWN_REFUSE_UNCHECKED go on (enough kills, enough of them reach-checked) and may
// ORIGINS_WORLD_RECORD_SCORECARD_ONLY (enough kills, enough of them with a record that verified)? Judged on the counts since the writer started, against the strictFlip row. Pure.
export type FlipGate = { kills: number; rate: number | null; ready: boolean };
export function flipReadiness(reach: Record<string, number>, records: Record<string, number>, rule: { minKills: number; minRate: number } = SERVER_RULES.strictFlip[0]!): { refuseUnchecked: FlipGate; scorecardOnly: FlipGate } {
  const gate = (outcomes: Record<string, number>, good: string): FlipGate => {
    const kills = Object.values(outcomes).reduce((a, b) => a + b, 0), rate = kills ? (outcomes[good] ?? 0) / kills : null;
    return { kills, rate, ready: kills >= rule.minKills && rate !== null && rate >= rule.minRate };
  };
  return { refuseUnchecked: gate(reach, 'checked'), scorecardOnly: gate(records, 'verified') };
}
export type VerifyJob = { text: string; spawn: Pick<Spawn, 'spec'>; kind: string; limit?: HeroLimit | null; maxTicks?: number; token?: string };
export async function verifyWorldRecord(text: string, spawn: Pick<Spawn, 'spec'>, kind: string, limit?: HeroLimit | null, maxTicks: number = MAX_WORLD_TICKS, token?: string): Promise<Verdict> {
  let rec;
  try { rec = await decodeWorldRecord(text); } catch { return { ok: false, reason: 'undecodable' }; }
  if (rec.steps.length > maxTicks) return { ok: false, reason: 'overlong' };   // refused before any replay: a record cannot be longer than the engagement it claims
  if (limit?.refuse) return { ok: false, reason: limit.refuse };
  if (limit && 'sheet' in limit && !sameSheet(rec.hero.sheet, limit.sheet)) return { ok: false, reason: 'sheet' };
  if (limit?.weapon !== undefined && rec.hero.weapon !== limit.weapon && rec.hero.weapon !== DEFAULT_WEAPON) return { ok: false, reason: 'weapon' };   // the weapon is the character's held one (the ledger's main hand) or the default (the world replay fights DEFAULT_WEAPON only until series PR 5 lifts that), never the record's say-so
  if (limit && specialsRefusal(rec.hero, limit.cut, true, rec.rv)) return { ok: false, reason: 'special' };   // the beta cut on specials (src/awards.ts): spells off but the utility ones, SPECIAL 1 and 2 inside the pick; judged before the grimoire, as the cut judges a level
  if (rec.hero.spell && limit && !(limit.spells && checkSpell(rec.hero.spell, limit.spells).ok)) return { ok: false, reason: 'spell' };   // the record's spell is a claim: it must be in the account's grimoire and no higher a skill than the character holds (spell-check.ts, the Pit's rule); no ledger read = nothing to vouch for it
  if (rec.hero.spell2 && limit && !(limit.spells && checkSpell(rec.hero.spell2, limit.spells).ok)) return { ok: false, reason: 'spell' };   // slot b is held to the same grimoire and skill ceiling; the structural rules (a slot-a spell beside it, no duplicate) are the replay's
  if (limit && limit.level !== undefined && rec.hero.level > limit.level) return { ok: false, reason: 'hero beyond ledger' };
  let r;
  try { r = replayWorldRecord(rec); } catch { return { ok: false, reason: 'replay threw' }; }
  if (!r.ok) return { ok: false, reason: r.reason };
  if (!r.kills.includes(spawn.spec.id)) return { ok: false, reason: 'no kill' };
  const j = r.joins.find((e) => e.id === spawn.spec.id);
  if (!j || j.kind !== kind || j.level !== spawn.spec.level) return { ok: false, reason: 'wrong creature' };
  // The bout's roll seed (bout-seed.ts): the kill's own creature may carry one only if it is hash32(the kill's engage token, its join step). Nothing the client sent is trusted; no seed = no roll (today's fight).
  if (j.seed !== undefined && (token === undefined || j.seed !== hash32(token, j.s))) return { ok: false, reason: 'seed' };
  if (!withinReach(spawn.spec, { x: j.x / CM_PER_M, z: j.z / CM_PER_M })) return { ok: false, reason: 'creature out of its roam' };
  return { ok: true, ticks: r.ticks };
}
