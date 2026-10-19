// A measuring tool, no game change (Lead 2026-10-19): the first foe attack + attacks/min + specials/min for foe levels 1..10, RV80 rows vs RV79 rows, an idle player after the draw (the veteran warden, three seeds, 60 s).
// Run: node scripts/sim-table.ts   (headless, a few seconds; the seeds, the 60 s cap and the warden are the constants at the top)
import '../tests/lib/era-on.ts';
import { forceSandbox, setRows79, setRows80, setSandbox } from '../src/fight/sandbox-era.ts';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/fight/moves.ts';
import { initialPractice, stepPractice } from '../src/fight/combat.ts';
import { specialsFromLevel } from '../src/fight/rows80.ts';
import { recordSpecials } from '../src/fight/replay.ts';   // the fight's own door for a fight's specials (C1: no deep import of src/core from a mode or tool)
import { act, idle } from '../tests/strategies.ts';

const SEEDS = [731, 9, 12345], TICKS = 60 * 60;   // 60 s of the fight at 60 ticks/s
const warden = LADDER[0]!.id as keyof typeof OPPONENTS;
const run = (rows80: boolean, level: number, seed: number) => {
  forceSandbox(undefined); setSandbox(true); setRows79(true); setRows80(rows80);
  const specials = level >= specialsFromLevel(16) ? recordSpecials({ specials: true, level, opponent: warden }) : undefined;
  let p = initialPractice(seed, opponentAt(OPPONENTS[warden], level), 'longsword', null, specials as never);
  const profile = profileAt(OPPONENTS[warden], level);
  let first = -1, firstSpecial = -1, attacks = 0, specs = 0, drawn = -1, end = TICKS;
  for (let i = 0; i < TICKS; i++) {
    p = stepPractice(p, i === 0 ? act('light') : idle(), profile);
    if (drawn < 0 && p.duel.fighters[0].phase !== 'sheathed') drawn = i;
    for (const e of p.duel.events as { type: string; actor?: number }[]) {
      if (e.type === 'AttackStarted' && e.actor === 1) { attacks++; if (first < 0) first = i; }
      if (e.type === 'SpecialStarted' && e.actor === 1) { specs++; if (firstSpecial < 0) firstSpecial = i; }
    }
    if (p.finish) { end = i + 1; break; }
  }
  return { first, firstSpecial, attacks, specs, end };
};
const f = (t: number) => (t < 0 ? '-' : (t / 60).toFixed(1) + 's');
for (const rows80 of [true, false]) {
  console.log(`\n== ${rows80 ? 'RV80 rows (specials from level 1, 2 s / 6 s timers, level-1 opener 10 s)' : 'RV79 rows (specials from level 16)'}  warden=${warden}`);
  console.log('level | first attack (seeds 731/9/12345) | first special | attacks/min | specials/min | fight ended at');
  for (let level = 1; level <= 10; level++) {
    const rs = SEEDS.map((s) => run(rows80, level, s));
    const perMin = (k: 'attacks' | 'specs') => rs.map((r) => (r[k] / (r.end / 3600)).toFixed(1)).join('/');
    console.log(`${String(level).padStart(2)}    | ${rs.map((r) => f(r.first)).join(' / ')} | ${rs.map((r) => f(r.firstSpecial)).join(' / ')} | ${perMin('attacks')} | ${perMin('specs')} | ${rs.map((r) => f(r.end)).join(' / ')}`);
  }
}
