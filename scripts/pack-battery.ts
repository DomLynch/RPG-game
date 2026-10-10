// Pack balance battery (Combat): a hero of a given gear rung against a camp of N creatures of one row at one level, the real world loop (src/fight/world.ts stepCombat, MAX_ATTACKERS 3), headless.
//   node scripts/pack-battery.ts   env: KIND (wolf), LEVELS (2,3), SIZES (1,2,3,4), RUNGS (0,2,4 = Recruit, 3rd, 5th tier), SEEDS (16), BOTS (masher,guard)
import { creature, newWorld, player, stepCombat, type Fighter, type Input, type World } from '../src/fight/world.ts';
import { fullSet, loadoutFor, NAKED } from '../src/fight/gear-stats.ts';
import { TIERS } from '../src/grades.ts';

const DT = 1 / 60, MAX_S = 120, env = (k: string, d: string) => (process.env[k] ?? d).split(',');
type Bot = (w: World, k: number) => Input;
const nearest = (w: World): Fighter | undefined => { const h = w.fighters[0]!; return w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead' && f.hunting).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0]; };
const BOTS: Record<string, Bot> = {
  masher: (_w, k) => ({ x: 0, z: 0, attack: k % 25 === 0 ? 'light' : null }),
  guard: (w, k) => { const f = nearest(w); return f && (f.phase === 'windup' || f.phase === 'active') ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null }; },
};
function fight(kind: string, level: number, size: number, rung: number, seed: number, bot: Bot) {
  const gear = rung === 0 ? NAKED : loadoutFor(fullSet(TIERS[rung]!, 'Longsword'));
  const foes = Array.from({ length: size }, (_, i) => { const a = (i / size) * Math.PI + 0.3 + seed * 0.37, r = 6 + (i % 2) * 1.2; return creature(`c${i}`, kind, Math.sin(a) * r, Math.cos(a) * r, a + Math.PI, level); });
  let w = newWorld([player('hero', 0, 0, 0, gear, 1), ...foes]);
  for (let k = 0; k < MAX_S / DT; k++) {
    w = stepCombat(w, { hero: bot(w, k) }, DT).world;
    const h = w.fighters[0]!, alive = w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead').length;
    if (h.phase === 'dead') return { win: false, died: true, hp: 0, t: k * DT, left: alive };
    if (!alive) return { win: true, died: false, hp: h.health / h.maxHealth, t: k * DT, left: 0 };
  }
  return { win: false, died: false, hp: w.fighters[0]!.health / w.fighters[0]!.maxHealth, t: MAX_S, left: -1 };
}
const kind = env('KIND', 'wolf')[0]!, seeds = +env('SEEDS', '16')[0]!;
for (const botName of env('BOTS', 'masher,guard')) for (const rung of env('RUNGS', '0,2,4').map(Number)) for (const level of env('LEVELS', '2,3').map(Number)) {
  const row = env('SIZES', '1,2,3,4').map(Number).map((size) => {
    const rs = Array.from({ length: seeds }, (_, s) => fight(kind, level, size, rung, s + 1, BOTS[botName]!));
    return `${size}:${rs.filter((r) => r.win).length}/${seeds} hp${(rs.filter((r) => r.win).reduce((a, r) => a + r.hp, 0) / Math.max(1, rs.filter((r) => r.win).length) * 100).toFixed(0)}%`;
  });
  console.log(`${botName.padEnd(6)} hero-rung ${rung} (${rung === 0 ? 'naked' : TIERS[rung]}) vs ${kind} L${level}  wins by pack size  ${row.join('  ')}`);
}
