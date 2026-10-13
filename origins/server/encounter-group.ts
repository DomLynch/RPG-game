// Verifying and paying a shared-health group (RV39; docs/specs/combat/threat-list.md "Anti-gank and loot"). Each stream is verified under the SERVER's parameters for that attacker (verifyStream: seed, enemy, level, kit),
// replaying from the incoming damage and held spans its own record carries; then the streams are checked AGAINST EACH OTHER: stream j's recorded incoming at tick t must equal the sum of the other streams'
// verified damage at t-1 (the pool's one tick of latency). Nothing is taken from a record: damage is the replay's own Hit and SpecialLanded amounts on the creature (dealtOn), the bar is the replayed creature's max health.
// Pay (a weight to multiply the creature's base reward by, per attacker): share = damage / bar (capped at 1) x JOIN_MULTIPLIER(join), join order = the stream's index. Only a stream that verified AND won (the creature fell in
// its copy) is paid; a stream that fails to verify, or whose incoming was forged, pays 0 and costs only its owner. Loot goes to the top damage among the paid, ties to the earlier joiner, and the killer is the hit that took
// the running total to the bar (same-tick hits in join order, as groupKill); BOTH are decided only when all n streams are present, since a withheld record could hold the top damage or the last hit. Pure: no I/O, no DB.
import type { FightRecord } from '../../src/fight/record.ts';
import { dealtOn } from '../../src/fight/pack.ts';
import { verifyStream, type EncounterParams } from './encounter-verify.ts';

export const JOIN_MULTIPLIERS = [1, 0.5, 0.25, 0.1] as const;
export const JOIN_MULTIPLIER = (join: number): number => JOIN_MULTIPLIERS[Math.min(join, JOIN_MULTIPLIERS.length - 1)]!;

export type StreamPay = { index: number; ok: boolean; reason?: string; won: boolean; damage: number; share: number; multiplier: number; weight: number; unproven: number };
export type GroupVerified = { ok: false; reason: string } | { ok: true; n: number; bar: number; streams: StreamPay[]; killer: number | null; loot: number | null };
const refuse = (reason: string): GroupVerified => ({ ok: false, reason });

export function verifyEncounterGroup(records: readonly FightRecord[], params: readonly EncounterParams[]): GroupVerified {
  const count = records.length;
  if (count < 1 || count !== params.length) return refuse('one set of server parameters per record');
  const first = records[0]!.group;
  if (!first) return refuse('a record without a group header is not a group stream');
  const n = first.n;
  if (count > n) return refuse('more records than the group has streams');
  if (count < 2) return refuse('a lone stream is the ordinary fight');
  const seen = new Set<number>();
  for (let k = 0; k < count; k++) {
    const g = records[k]!.group, p = params[k]!;
    if (!g) return refuse('a record without a group header is not a group stream');
    if (g.n !== n) return refuse('the records name different group sizes');
    if (seen.has(g.index)) return refuse('a stream is repeated');
    seen.add(g.index);
    if (p.enemy !== params[0]!.enemy || p.level !== params[0]!.level) return refuse('the streams do not name one creature (enemy and level differ)');
  }
  const order = records.map((_, k) => k).sort((a, b) => records[a]!.group!.index - records[b]!.group!.index);
  const dealt = new Map<number, Map<number, number>>(), results = new Map<number, StreamPay>();
  let bar = 0;
  for (const k of order) {
    const r = records[k]!, index = r.group!.index, series = new Map<number, number>();
    let streamBar = 0;
    const v = verifyStream(r, params[k]!, (practice) => { streamBar = practice.duel.fighters[1].maxHealth; const d = dealtOn(practice.duel); if (d) series.set(practice.duel.tick, d); });
    const base: StreamPay = { index, ok: v.ok, won: v.ok && v.result === 'won', damage: 0, share: 0, multiplier: JOIN_MULTIPLIER(index), weight: 0, unproven: 0 };
    if (!v.ok) { results.set(index, { ...base, reason: v.reason }); continue; }
    if (bar && streamBar !== bar) { results.set(index, { ...base, ok: false, won: false, reason: 'the creature\'s health differs from the other streams\'' }); continue; }
    bar = streamBar;
    dealt.set(index, series);
    results.set(index, { ...base, damage: [...series.values()].reduce((a, b) => a + b, 0) });
  }
  for (const k of order) {
    const g = records[k]!.group!, c = results.get(g.index)!;
    if (!c.ok) continue;
    const mine = new Map(g.incoming), ticks = new Set<number>(mine.keys());
    for (const [j, s] of dealt) if (j !== g.index) for (const t of s.keys()) ticks.add(t + 1);
    for (const t of [...ticks].sort((a, b) => a - b)) {
      const exp = [...dealt].reduce((sum, [j, s]) => (j === g.index ? sum : sum + (s.get(t - 1) ?? 0)), 0), got = mine.get(t) ?? 0;
      if (got === exp) continue;
      if (got > exp && dealt.size < n) { c.unproven += got - exp; continue; }   // damage claimed from a record nobody produced: it never blocks the others
      results.set(g.index, { ...c, ok: false, won: false, damage: 0, reason: `tick ${t}: recorded incoming ${got}, the siblings dealt ${exp}`, unproven: c.unproven });
      break;
    }
  }
  const streams = [...results.values()].sort((a, b) => a.index - b.index).map((s): StreamPay => {
    if (!s.ok || !s.won) return { ...s, damage: s.ok ? s.damage : 0, share: 0, weight: 0 };
    const share = Math.min(1, s.damage / bar);
    return { ...s, share, weight: share * s.multiplier };
  });
  if (!streams.some((s) => s.won)) return refuse('no stream verified with the creature down');
  const whole = count === n && streams.every((s) => s.ok);
  const paid = streams.filter((s) => s.weight > 0);
  let killer: number | null = null, loot: number | null = null;
  if (whole) {
    const hits = [...dealt].flatMap(([index, series]) => [...series].map(([tick, damage]) => ({ tick, index, damage }))).sort((a, b) => a.tick - b.tick || a.index - b.index);
    let total = 0;
    for (const h of hits) { total += h.damage; if (total >= bar) { killer = h.index; break; } }
    if (paid.length) loot = paid.reduce((best, s) => (s.damage > best.damage ? s : best), paid[0]!).index;
  }
  return { ok: true, n, bar, streams, killer, loot };
}
