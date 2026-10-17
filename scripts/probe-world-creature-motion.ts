// Probe: how fast does a WORLD creature move around a hero who stands still? (zone sandbox, Dom 2026-10-17: "creatures twitch like an FPS on my phone, the salamander is right then left in under a second").
// Headless, no GPU, no page: it drives createWorldCombat (src/fight/world-combat.ts over stepCombat) with a fake mob port, the hero auto-facing his foe as the page does, and measures the engine's own creature pose.
// Run:  node scripts/probe-world-creature-motion.ts [kind ...] [--level=1] [--seeds=8] [--seconds=20] [--gap=6]
//   kinds default to: giant-salamander wolf cave-troll goblin boar   (any kind that kindOf() accepts)
//   seeds: the creature id is `<kind>-<n>` for n = 1..seeds; the id seeds the bout, so each n is a different fight stream.
// Prints one line per kind (mean over seeds) and a per-seed line with --verbose:
//   sweep deg/s = |angular change of the creature around the hero| per second (avg, max, % of frames over 90), flips/s = direction reversals of that sweep per second,
//   gap = hero-to-creature distance (avg, min), speed = the creature's own m/s (avg, p95, max), turn deg/s = the facing change per second (avg, max), hits = hero hits taken.
// BASELINE (2026-10-17, sandbox branch engine, level 1, seed n=1, 20 s): see the PR/message that carried this file. Thresholds belong in the PR that adds the new rows (circle re-decide interval, turn cap, strafe cap).
import { createWorldCombat } from '../src/fight/index.ts';
import type { MobDrive, MobPick } from '../origins/preview/mobs-view.ts';
import type { MobSpec } from '../origins/preview/mobs.ts';

const args = process.argv.slice(2), flag = (k: string, d: number) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const kinds = args.filter((a) => !a.startsWith('--')), LEVEL = flag('level', 1), SEEDS = flag('seeds', 8), SECONDS = flag('seconds', 20), GAP = flag('gap', 6), VERBOSE = args.includes('--verbose');
const KINDS = kinds.length ? kinds : ['giant-salamander', 'wolf', 'cave-troll', 'goblin', 'boar'], DT = 1 / 30;
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

type Run = { sweepAvg: number; sweepMax: number; fast: number; flips: number; gapAvg: number; gapMin: number; vAvg: number; vP95: number; vMax: number; turnAvg: number; turnMax: number; hits: number; frames: number };

function one(body: string, n: number): Run {
  const spec = { id: `${body}-${n}`, body, name: body, level: LEVEL, named: false } as unknown as MobSpec;
  const list = [{ spec, x: 0, z: GAP }], driven = new Map<string, MobDrive>(), fell: string[] = [];
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (id: string, p: MobDrive | null) => { if (p) driven.set(id, p); else driven.delete(id); }, fell: (id: string) => void fell.push(id), play: () => 0.5 } as never;
  let hits = 0; const wc = createWorldCombat({ mobs: () => mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => void hits++, onSwing: () => {} } as never);
  const hero = { x: 0, z: 0, facing: 0 }; let prev: MobDrive | null = null, prevDa = 0; const sweep: number[] = [], gap: number[] = [], speed: number[] = [], turn: number[] = []; let flips = 0;
  for (let t = 0; t < SECONDS; t += DT) {
    const d = driven.get(spec.id); if (d) hero.facing = Math.atan2(d.x - hero.x, d.z - hero.z);   // the hero faces his foe, as the page does
    wc.update(DT, hero);
    const p = driven.get(spec.id);
    if (p && prev) {
      const da = wrap(Math.atan2(p.x, p.z) - Math.atan2(prev.x, prev.z)); sweep.push(Math.abs(da) * 180 / Math.PI / DT); gap.push(Math.hypot(p.x, p.z));
      speed.push(Math.hypot(p.x - prev.x, p.z - prev.z) / DT); turn.push(Math.abs(wrap(p.facing - prev.facing)) * 180 / Math.PI / DT);
      if (Math.abs(da) > 1e-4) { if (prevDa !== 0 && Math.sign(da) !== Math.sign(prevDa)) flips++; prevDa = da; }
    }
    prev = p ? { ...p } : null;
  }
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), max = (a: number[]) => Math.max(0, ...a), p95 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(0.95 * (a.length - 1))] ?? 0;
  return { sweepAvg: avg(sweep), sweepMax: max(sweep), fast: sweep.filter((s) => s > 90).length / Math.max(1, sweep.length), flips: flips / SECONDS, gapAvg: avg(gap), gapMin: gap.length ? Math.min(...gap) : 0, vAvg: avg(speed), vP95: p95(speed), vMax: max(speed), turnAvg: avg(turn), turnMax: max(turn), hits, frames: sweep.length };
}

const f = (x: number, d = 1) => x.toFixed(d);
for (const body of KINDS) {
  const runs = Array.from({ length: SEEDS }, (_, i) => one(body, i + 1)), m = (k: keyof Run) => runs.reduce((s, r) => s + r[k], 0) / runs.length, mx = (k: keyof Run) => Math.max(...runs.map((r) => r[k]));
  console.log(`${body.padEnd(17)} seeds ${SEEDS} lvl ${LEVEL}  sweep deg/s avg ${f(m('sweepAvg'))} max ${f(mx('sweepMax'))} over90 ${f(100 * m('fast'), 0)}%  flips/s ${f(m('flips'), 2)}  gap avg ${f(m('gapAvg'), 2)} min ${f(Math.min(...runs.map((r) => r.gapMin)), 2)}  speed m/s avg ${f(m('vAvg'))} p95 ${f(m('vP95'))} max ${f(mx('vMax'))}  turn deg/s avg ${f(m('turnAvg'))} max ${f(mx('turnMax'))}  hits ${f(m('hits'))}`);
  if (VERBOSE) runs.forEach((r, i) => console.log(`  seed ${i + 1}: sweep avg ${f(r.sweepAvg)} max ${f(r.sweepMax)} flips/s ${f(r.flips, 2)} speed max ${f(r.vMax)} turn max ${f(r.turnMax)} hits ${r.hits}`));
}
