// One pack fight, second by second (Combat, many-on-one step 0): why is troll + one goblin 0 of 32 when the troll alone is beaten 91%? A hero of a gear rung against a camp (a KIND creature plus ESCORTS of ESCORT),
// the real world loop (stepCombat), the guard bot. Prints each second: the hero's hp, every creature's phase / hp / whether it is biting, and the damage each creature dealt that second. The mechanism is read off this.
//   node scripts/pack-trace.ts   env: KIND (cave-troll), LEVEL (3), ESCORT (goblin), ESCORT_LEVEL (2), ESCORTS (1), RUNG (4), SEED (1), HERO_LEVEL (LEVEL)
import { creature, newWorld, player, stepCombat, type Fighter, type Input, type World } from '../src/fight/world.ts';
import { rungSheet } from './lib/rung-sheet.ts';

const env = (k: string, d: string) => process.env[k] ?? d, DT = 1 / 60;
const kind = env('KIND', 'cave-troll'), level = +env('LEVEL', '3'), escort = env('ESCORT', 'goblin'), escortLevel = +env('ESCORT_LEVEL', '2'), escorts = +env('ESCORTS', '1'), rung = +env('RUNG', '4'), seed = +env('SEED', '1'), heroLevel = +env('HERO_LEVEL', String(level));
const nearest = (w: World): Fighter | undefined => { const h = w.fighters[0]!; return w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead' && f.hunting).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0]; };
const guard = (w: World, k: number): Input => { const f = nearest(w); return f && (f.phase === 'windup' || f.phase === 'active') ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null }; };
const sheet = rungSheet(rung, heroLevel), total = 1 + escorts;
const foes = Array.from({ length: total }, (_, i) => { const a = (i / total) * Math.PI + 0.3 + seed * 0.37, r = 6 + (i % 2) * 1.2; return creature(i === 0 ? 'troll' : `esc${i}`, i === 0 ? kind : escort, Math.sin(a) * r, Math.cos(a) * r, a + Math.PI, i === 0 ? level : escortLevel); });
let w = newWorld([player('hero', 0, 0, 0, heroLevel, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }), ...foes]);
const dealt: Record<string, number> = {}, hits: Record<string, number> = {};
console.log(`hero L${heroLevel} rung ${rung} maxHp ${w.fighters[0]!.maxHealth} vs ${kind} L${level} + ${escorts} ${escort} L${escortLevel}`);
for (let k = 0; k < 120 * 60; k++) {
  if (env('FOCUS', '0') === '1') { const t = w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead' && f.hunting).sort((a, b) => a.health - b.health)[0], hh = w.fighters[0]!; if (t) w = { ...w, fighters: w.fighters.map((f, i) => (i === 0 ? { ...f, facing: Math.atan2(t.x - hh.x, t.z - hh.z) } : f)) }; }   // FOCUS=1: he turns to the weakest living creature (the retarget bot)
  const r = stepCombat(w, { hero: guard(w, k) }, DT); w = r.world;
  for (const e of r.events) if (e.type === 'Hit') { if (e.victim === 'hero') { dealt[e.attacker] = (dealt[e.attacker] ?? 0) + e.damage; hits[e.attacker] = (hits[e.attacker] ?? 0) + 1; } }
  const h = w.fighters[0]!;
  if (k % 60 === 0 || h.phase === 'dead') {
    const cs = w.fighters.filter((f) => f.side === 'creature').map((f) => `${f.id}:${f.phase}${f.hunting ? '' : '(idle)'} hp${Math.round(f.health)}/${Math.round(f.maxHealth)} dealt${Math.round(dealt[f.id] ?? 0)}/${hits[f.id] ?? 0}hits`).join('  ');
    console.log(`t${(k * DT).toFixed(0).padStart(3)}s hero ${Math.round(h.health)}/${Math.round(h.maxHealth)} ${h.phase.padEnd(8)} foe:${(w.streams.hero?.foe ?? '-').padEnd(5)}| ${cs}`);
  }
  if (h.phase === 'dead') { console.log('HERO DEAD'); break; }
  if (w.fighters.every((f) => f.side !== 'creature' || f.phase === 'dead')) { console.log('ALL CREATURES DEAD'); break; }
}
