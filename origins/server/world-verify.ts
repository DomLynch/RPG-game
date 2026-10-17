// BASE (Lead, 2026-10-13): a world kill's record, replayed on the server through the world loop (src/fight/world-record.ts, the same stepHero the page ran) before anything spendable or permanent pays.
// Verified = the record decodes, its hero claims are inside the caps (and inside the server's own ledger when it has one), it replays without a bound broken, the hero kills THIS spawn, and that
// creature joined as the spawn's own kind and level inside its roam. Anything else is "unverified": the caller pays scorecard counts only. Never throws.
import { DEFAULT_WEAPON, MAX_WORLD_TICKS, decodeWorldRecord, hash32, replayWorldRecord } from '../../src/fight/server.ts';
import type { Sheet } from '../../src/fight/server.ts';
import { withinReach, type Spawn } from './world-spawns.ts';
import { checkSpell, type SpellHeld } from './spell-check.ts';

export const MAX_RECORD_CHARS = 60_000;   // under the writer's 64 KB body limit
/** The most steps an engagement of this age (s) can hold, plus two seconds for the window that opened just before the token. */
export const ticksFor = (ageS: number): number => Math.floor(60 * (Number.isFinite(ageS) ? Math.max(0, ageS) : 0)) + 120;
export type HeroLimit = { level?: number; sheet?: Sheet; weapon?: string; spells?: SpellHeld; refuse?: string };   // `sheet` present (even undefined) = the record's sheet must EQUAL it (heroLimitOf, the Pit's rule); `refuse` = the books could not give one; attack/res: the older Loadout bound   // what the server's own books allow him: a claim above it is refused (a limit with no level binds the gear only: the worn Loadout the ledger holds)
const sameSheet = (a: Sheet | undefined, b: Sheet | undefined): boolean => { const x = Object.entries(a ?? {}), y = b ?? {}; return x.length === Object.keys(y).length && x.every(([k, v]) => y[k] === v); };
export type Verdict = { ok: true; ticks: number } | { ok: false; reason: string };

/** What a replay needs, all plain data (it crosses to the worker thread). */
// Soak counters: kills by outcome ('verified', 'no record', or the refusal reason), so the verified rate is one read once the records are live.
export type VerdictTally = { add(outcome: string): void; snapshot(): { since: string; total: number; verified: number; rate: number | null; outcomes: Record<string, number> } };
export function createVerdictTally(now: () => Date = () => new Date()): VerdictTally {
  const since = now().toISOString(), outcomes: Record<string, number> = {};
  return { add: (o) => { outcomes[o] = (outcomes[o] ?? 0) + 1; }, snapshot: () => { const total = Object.values(outcomes).reduce((a, b) => a + b, 0), verified = outcomes.verified ?? 0; return { since, total, verified, rate: total ? verified / total : null, outcomes: { ...outcomes } }; } };
}
export type VerifyJob = { text: string; spawn: Pick<Spawn, 'spec'>; kind: string; limit?: HeroLimit | null; maxTicks?: number; token?: string };
export async function verifyWorldRecord(text: string, spawn: Pick<Spawn, 'spec'>, kind: string, limit?: HeroLimit | null, maxTicks: number = MAX_WORLD_TICKS, token?: string): Promise<Verdict> {
  let rec;
  try { rec = await decodeWorldRecord(text); } catch { return { ok: false, reason: 'undecodable' }; }
  if (rec.steps.length > maxTicks) return { ok: false, reason: 'overlong' };   // refused before any replay: a record cannot be longer than the engagement it claims
  if (limit?.refuse) return { ok: false, reason: limit.refuse };
  if (limit && 'sheet' in limit && !sameSheet(rec.hero.sheet, limit.sheet)) return { ok: false, reason: 'sheet' };
  if (limit?.weapon !== undefined && rec.hero.weapon !== limit.weapon && rec.hero.weapon !== DEFAULT_WEAPON) return { ok: false, reason: 'weapon' };   // the weapon is the character's held one (the ledger's main hand) or the default (the world replay fights DEFAULT_WEAPON only until series PR 5 lifts that), never the record's say-so
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
  if (!withinReach(spawn.spec, { x: j.x / 100, z: j.z / 100 })) return { ok: false, reason: 'creature out of its roam' };
  return { ok: true, ticks: r.ticks };
}
