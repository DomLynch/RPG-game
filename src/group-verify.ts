// Verifying a shared-health group from whichever of its records are present (RV39, Auditor hole 1). Outside SIM_FILES, reads records and writes nothing.
// Each record verifies ALONE (replay.ts applies the incoming damage and held spans its own header carries). Then the set is cross-checked: stream i's recorded incoming at tick t must be the sum of the OTHER present
// streams' verified damage on tick t-1 (the pool's one tick of latency). With every sibling present the two must be equal. With a sibling missing the recorded incoming can only be >= what the present ones account for, and
// the excess is `unproven`: damage claimed from a record nobody produced. It costs the owner of the missing record (Backend pays on proven shares only); it never blocks the others.
import type { FightRecord } from './record.ts';
import { dealtOn } from './pack.ts';
import { verifyRecord } from './replay.ts';

export type GroupCheck = { index: number; ok: boolean; reason?: string; unproven: number };

export function crossCheck(records: readonly FightRecord[]): GroupCheck[] {
  const dealt = new Map<number, Map<number, number>>(), checks = new Map<number, GroupCheck>();
  let n = 0;
  for (const r of records) {
    const g = r.group;
    if (!g) throw RangeError('Group check: a record without a group');
    n = g.n;
    if (g.n !== n || checks.has(g.index)) throw RangeError('Group check: records of different groups or a repeated stream');
    const series = new Map<number, number>();
    const v = verifyRecord(r, (p) => { const d = dealtOn(p.duel); if (d) series.set(p.duel.tick, d); });
    checks.set(g.index, v.ok ? { index: g.index, ok: true, unproven: 0 } : { index: g.index, ok: false, reason: v.reason, unproven: 0 });
    if (v.ok) dealt.set(g.index, series);
  }
  for (const r of records) {
    const g = r.group!, c = checks.get(g.index)!;
    if (!c.ok) continue;
    const mine = new Map(g.incoming), ticks = new Set<number>(mine.keys());
    for (const [j, s] of dealt) if (j !== g.index) for (const t of s.keys()) ticks.add(t + 1);
    for (const t of [...ticks].sort((a, b) => a - b)) {
      const exp = [...dealt].reduce((sum, [j, s]) => (j === g.index ? sum : sum + (s.get(t - 1) ?? 0)), 0), got = mine.get(t) ?? 0;
      if (got === exp) continue;
      if (got > exp && dealt.size < n) { c.unproven += got - exp; continue; }
      checks.set(g.index, { index: g.index, ok: false, reason: `tick ${t}: recorded incoming ${got}, the siblings dealt ${exp}`, unproven: c.unproven });
      break;
    }
  }
  return [...checks.values()].sort((a, b) => a.index - b.index);
}
