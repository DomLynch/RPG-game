// Kite-farm battery (Combat, disengage receipt): can a loop of hitting and running farm a creature? Four hero behaviours against one creature, the real world loop (stepCombat), headless.
//   stand    : stands and trades (the control).
//   backoff  : trades, runs straight away under BACKOFF health; once the creature gives up and walks home he does nothing more.
//   pursue   : backoff, then turns round and attacks the creature while it walks home (the evade-bug shape: AzerothCore's creature that cannot fight back).
//   hitrun   : hits when the creature is close, runs when it winds up, never leaves its sight (14 m): the give-up timer cannot start.
//   circle   : runs a circle of CIRCLE_M around where the chase began (the leash edge, 30 m), hitting on the way.
//   tag      : two heroes; the first backs off as `backoff`, the second waits 20 m away and trades when the creature comes.
// Per case (SEEDS runs): hero deaths, creature kills, kills WHILE it was walking home (a free kill), damage dealt to it while it walked home, health it carried across a reset (the Evaded event: must be full), longest time it was worn below half.
// Donor: AzerothCore CreatureAI::_EnterEvadeMode (combat stop, loot recipient and damage requirement cleared) and EQEmu mob_ai.cpp leash (hate list wiped past the leash, measured from the spawn point).
//   node scripts/kite-farm.ts   env: KIND (goblin), LEVEL (2), CASES (stand,backoff,pursue,hitrun,circle,tag), SEEDS (16), BACKOFF (0.5), CIRCLE_M (26), RECRUIT (1)
import { creature, newWorld, player, stepCombat, type Fighter, type Input, type World } from '../src/fight/world.ts';
import { rungSheet } from './lib/rung-sheet.ts';

const DT = 1 / 60, MAX_S = 180, env = (k: string, d: string) => process.env[k] ?? d;
const kind = env('KIND', 'goblin'), level = +env('LEVEL', '2'), seeds = +env('SEEDS', '16'), backoff = +env('BACKOFF', '0.5'), circleM = +env('CIRCLE_M', '26');
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const away = (h: Fighter, c: Fighter, turn = 0): Input => { const a = Math.atan2(h.x - c.x, h.z - c.z) + turn; return { x: Math.sin(a), z: Math.cos(a), run: true }; };
const toward = (h: Fighter, c: Fighter): Input => { const d = dist(h, c) || 1; return { x: (c.x - h.x) / d, z: (c.z - h.z) / d, run: true }; };
const swing = (c: Fighter) => c.phase === 'windup' || c.phase === 'active';
type Ctx = { w: World; k: number; h: Fighter; c: Fighter; s: { gone?: boolean } };
const trade = ({ h, c, k }: Ctx): Input => (swing(c) && dist(h, c) < 5 ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null });
const BOTS: Record<string, (x: Ctx) => Input> = {
  stand: trade,
  backoff: (x) => (x.c.returning || x.h.health <= x.h.maxHealth * backoff ? (x.c.returning ? { x: 0, z: 0 } : away(x.h, x.c)) : trade(x)),
  pursue: (x) => { if (x.c.returning) return dist(x.h, x.c) > 3 ? toward(x.h, x.c) : { x: 0, z: 0, attack: 'light' }; return x.h.health <= x.h.maxHealth * backoff ? away(x.h, x.c) : trade(x); },
  hitrun: (x) => (swing(x.c) && dist(x.h, x.c) < 8 ? away(x.h, x.c) : dist(x.h, x.c) > 11 ? toward(x.h, x.c) : trade(x)),
  circle: (x) => { const home = { x: x.c.chaseX, z: x.c.chaseZ }, r = dist(x.h, home); if (!x.c.hunting || r < 2) return trade(x); return swing(x.c) && dist(x.h, x.c) < 6 ? away(x.h, x.c, r < circleM ? 0.9 : 2.2) : dist(x.h, x.c) < 4 ? { x: 0, z: 0, attack: x.k % 20 === 0 ? 'light' : null } : { x: 0, z: 0 }; },
  tag: (x) => BOTS.backoff!(x),
};
function run(name: string, seed: number) {
  const sheet = rungSheet(0, level, 'plate', env('RECRUIT', '1') === '1'), a = seed * 0.37;
  const hero = (id: string, x: number, z: number) => player(id, x, z, 0, level, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) });
  const heroes = name === 'tag' ? [hero('hero', 0, 0), hero('hero2', 14, 0)] : [hero('hero', 0, 0)];
  let w = newWorld([...heroes, creature('c0', kind, Math.sin(a) * 7, Math.cos(a) * 7, a + Math.PI, level)]);
  const st = { gone: false }, r = { heroDied: false, killed: false, killedHome: false, homeDmg: 0, resetHp: 1, worn: 0, longest: 0, resets: 0, by: '' };
  for (let k = 0; k < MAX_S / DT; k++) {
    const c = w.fighters.find((f) => f.id === 'c0')!, h = w.fighters[0]!, h2 = w.fighters.find((f) => f.id === 'hero2');
    const was = c.returning, inputs: Record<string, Input> = { hero: BOTS[name]!({ w, k, h, c, s: st }) };
    if (h2) inputs.hero2 = BOTS.stand!({ w, k, h: h2, c, s: st });
    const res = stepCombat(w, inputs, DT); w = res.world;
    const c2 = w.fighters.find((f) => f.id === 'c0');
    for (const e of res.events) {
      if (e.type === 'Hit' && e.victim === 'c0' && was) r.homeDmg += e.damage;
      if (e.type === 'Died' && e.id === 'c0') { r.killed = true; r.killedHome ||= was; r.by = e.by; }
      if (e.type === 'Died' && e.id.startsWith('hero')) r.heroDied = true;
      if (e.type === 'Evaded' && c2) { r.resets++; r.resetHp = Math.min(r.resetHp, c2.health / c2.maxHealth); }
    }
    if (c2 && !r.killed && c2.health < c2.maxHealth * 0.5) { r.worn += DT; r.longest = Math.max(r.longest, r.worn); } else r.worn = 0;
    if (r.killed || r.heroDied) break;
  }
  return r;
}
for (const name of env('CASES', 'stand,backoff,pursue,hitrun,circle,tag').split(',')) {
  const rs = Array.from({ length: seeds }, (_, s) => run(name, s + 1)), n = (f: (r: ReturnType<typeof run>) => boolean) => rs.filter(f).length;
  console.log(`${name.padEnd(8)} ${kind} L${level}: hero died ${n((r) => r.heroDied)}/${seeds}, creature killed ${n((r) => r.killed)}, killed while walking home ${n((r) => r.killedHome)}, dmg while home ${rs.reduce((a, r) => a + r.homeDmg, 0).toFixed(0)}, resets ${rs.reduce((a, r) => a + r.resets, 0)} (lowest hp carried over a reset ${(Math.min(...rs.map((r) => r.resetHp)) * 100).toFixed(0)}%), longest worn <50% ${Math.max(...rs.map((r) => r.longest)).toFixed(1)}s`);
}
