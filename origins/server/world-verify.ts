// BASE (Lead, 2026-10-13): a world kill's record, replayed on the server through the world loop (src/fight/world-record.ts, the same stepHero the page ran) before anything spendable or permanent pays.
// Verified = the record decodes, its hero claims are inside the caps (and inside the server's own ledger when it has one), it replays without a bound broken, the hero kills THIS spawn, and that
// creature joined as the spawn's own kind and level inside its roam. Anything else is "unverified": the caller pays scorecard counts only. Never throws.
import { decodeWorldRecord, replayWorldRecord } from '../../src/fight/server.ts';
import { withinReach, type Spawn } from './world-spawns.ts';

export const MAX_RECORD_CHARS = 60_000;   // under the writer's 64 KB body limit
export type HeroLimit = { level: number; attack: number; res: number };   // what the server's own books allow him: a claim above it is refused
export type Verdict = { ok: true; ticks: number } | { ok: false; reason: string };

export async function verifyWorldRecord(text: string, spawn: Spawn, kind: string, limit?: HeroLimit | null): Promise<Verdict> {
  let rec;
  try { rec = await decodeWorldRecord(text); } catch { return { ok: false, reason: 'undecodable' }; }
  if (limit && (rec.hero.level > limit.level || rec.hero.attack > limit.attack || rec.hero.res < limit.res)) return { ok: false, reason: 'hero beyond ledger' };
  let r;
  try { r = replayWorldRecord(rec); } catch { return { ok: false, reason: 'replay threw' }; }
  if (!r.ok) return { ok: false, reason: r.reason };
  if (!r.kills.includes(spawn.spec.id)) return { ok: false, reason: 'no kill' };
  const j = r.joins.find((e) => e.id === spawn.spec.id);
  if (!j || j.kind !== kind || j.level !== spawn.spec.level) return { ok: false, reason: 'wrong creature' };
  if (!withinReach(spawn.spec, { x: j.x / 100, z: j.z / 100 })) return { ok: false, reason: 'creature out of its roam' };
  return { ok: true, ticks: r.ticks };
}
