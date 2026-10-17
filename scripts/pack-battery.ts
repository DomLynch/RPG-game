// Pack balance battery (Combat): a hero of a given gear rung against a camp of N creatures of one row at one level, the real world loop (src/fight/world.ts stepCombat, MAX_ATTACKERS 3), headless.
//   READOUT=1 adds the many-on-one reading per cell: the most creatures in windup/active at once (turn-taking: MAX_ATTACKERS 3, the 4th holds at the ring) and the share of the fight with 3 or more biting.
//   node scripts/pack-battery.ts   env: KIND (wolf), LEVELS (2,3), SIZES (1,2,3,4), RUNGS (0,2,4 = Recruit, 3rd, 5th tier), SEEDS (16), BOTS (masher,guard), ESCORT (goblin), ESCORTS (0)
import { creature, newWorld, player, stepCombat, type Fighter, type Input, type World } from '../src/fight/world.ts';
import { TIERS } from '../src/core/server.ts';
import { rungSheet } from './lib/rung-sheet.ts';
import { wornGear } from '../src/fight/gear-stats.ts';
import { TIERS as GRADES } from '../src/core/grades.ts';
import { SLOT_ROWS } from '../src/fight/roll.ts';

const DT = 1 / 60, MAX_S = 120, env = (k: string, d: string) => (process.env[k] ?? d).split(',');
type Bot = (w: World, k: number) => Input;
const nearest = (w: World): Fighter | undefined => { const h = w.fighters[0]!; return w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead' && f.hunting).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0]; };
const BOTS: Record<string, Bot> = {
  masher: (_w, k) => ({ x: 0, z: 0, attack: k % 25 === 0 ? 'light' : null }),
  guard: (w, k) => { const f = nearest(w); return f && (f.phase === 'windup' || f.phase === 'active') ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null }; },
};
// retreat: trades like the guard bot until his health drops under BACKOFF (env, default 0.5 of max), then runs straight away from the nearest hunter (a creature's chase is slower than a running player). The disengage acceptance: a Recruit who pulls one goblin and backs off survives.
const BACKOFF = +(process.env.BACKOFF ?? '0.5');
BOTS.retreat = (w, k) => { const h = w.fighters[0]!, f = nearest(w); if (!f || h.health > h.maxHealth * BACKOFF) return BOTS.guard!(w, k); const dx = h.x - f.x, dz = h.z - f.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, run: true }; };
BOTS.focus = BOTS.guard!;   // guard, and he turns to face the weakest living creature (the retarget cone picks his foe by where he faces)
const FACE: Record<string, (w: World) => number | undefined> = { focus: (w) => { const h = w.fighters[0]!, t = w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead' && f.hunting).sort((a, b) => a.health - b.health)[0]; return t ? Math.atan2(t.x - h.x, t.z - h.z) : undefined; } };
function fight(kind: string, level: number, size: number, rung: number, seed: number, bot: Bot, botName = '') {
  const starter = process.env.KIT === 'starter' ? wornGear({ head: 'goblin.Helmet', legs: 'goblin.Greaves' }, () => GRADES[0]) : process.env.KIT === 'goblin' ? wornGear({ head: 'goblin.Helmet', body: 'goblin.Body', arms: 'goblin.Arms', hands: 'goblin.Gloves', legs: 'goblin.Greaves', feet: 'goblin.Boots' } as Parameters<typeof wornGear>[0], () => GRADES[+(process.env.GOBLIN_TIER ?? '0')]) : undefined;   // KIT=starter: only the starter armour (goblin helmet + shin plates at Recruit), not the full plate set; KIT=goblin: the whole goblin drop set (six pieces) at GOBLIN_TIER (default 0 = Recruit)
  const sheet = rungSheet(rung, heroLevel ?? level, 'plate', process.env.RECRUIT === '1', starter);   // the worn set's dial deltas on the default build (was a Loadout passed as player()'s `level` argument, so every rung fought naked)
  const total = size + escorts, foes = Array.from({ length: total }, (_, i) => { const a = (i / total) * Math.PI + 0.3 + seed * 0.37, r = 6 + (i % 2) * 1.2; return creature(`c${i}`, i < size ? kind : escort, Math.sin(a) * r, Math.cos(a) * r, a + Math.PI, i < size ? level : escortLevel ?? level); });
  let w = newWorld([player('hero', 0, 0, 0, heroLevel ?? level, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }), ...foes]), peak = 0, three = 0, ticks = 0;
  for (let k = 0; k < MAX_S / DT; k++) {
    const face = FACE[botName]?.(w); if (face !== undefined) w = { ...w, fighters: w.fighters.map((f, i) => (i === 0 ? { ...f, facing: face } : f)) };
    w = stepCombat(w, { hero: bot(w, k) }, DT).world;
    const biting = w.fighters.filter((f) => f.side === 'creature' && (f.phase === 'windup' || f.phase === 'active')).length; peak = Math.max(peak, biting); ticks++; if (biting >= 3) three++;
    const h = w.fighters[0]!, alive = w.fighters.filter((f) => f.side === 'creature' && f.phase !== 'dead').length;
    if (h.phase === 'dead') return { win: false, died: true, hp: 0, t: k * DT, left: alive, peak, three: three / ticks };
    if (!alive) return { win: true, died: false, hp: h.health / h.maxHealth, t: k * DT, left: 0, peak, three: three / ticks };
  }
  return { win: false, died: false, hp: w.fighters[0]!.health / w.fighters[0]!.maxHealth, t: MAX_S, left: -1, peak, three: three / ticks };
}
for (const kv of (process.env.SLOTS ?? '').split(',').filter(Boolean)) { const [id, pct] = kv.split('='); const row = SLOT_ROWS.find((r) => r.id === id); if (!row) throw Error(`SLOTS: no swarm-defs slot row "${id}"`); (row as { percent: number }).percent = +pct!; }   // SLOTS=mob2=30,mob3=20: an experiment's override of the crowd-cut rows (swarm-defs.json), never a shipped number
const escortLevel = process.env.ESCORT_LEVEL ? +process.env.ESCORT_LEVEL : undefined;   // ESCORT_LEVEL: the escorts' level (default: the pack's level)
const heroLevel = process.env.HERO_LEVEL ? +process.env.HERO_LEVEL : undefined;   // HERO_LEVEL: the hero's level (build points placed and his level argument); default the creature's level
const kind = env('KIND', 'wolf')[0]!, seeds = +env('SEEDS', '16')[0]!, escort = env('ESCORT', 'goblin')[0]!, escorts = +env('ESCORTS', '0')[0]!;   // ESCORTS=n adds n creatures of ESCORT (default goblin, the scavenger's body) beside the SIZES of KIND
for (const botName of env('BOTS', 'masher,guard')) for (const rung of env('RUNGS', '0,2,4').map(Number)) for (const level of env('LEVELS', '2,3').map(Number)) {
  const row = env('SIZES', '1,2,3,4').map(Number).map((size) => {
    const rs = Array.from({ length: seeds }, (_, s) => fight(kind, level, size, rung, s + 1, BOTS[botName]!, botName));
    const read = process.env.READOUT ? ` [peak ${Math.max(...rs.map((r) => r.peak))}, 3+ biting ${(rs.reduce((a, r) => a + r.three, 0) / seeds * 100).toFixed(0)}%]` : '';
    return `${size}:${rs.filter((r) => r.win).length}/${seeds} (survived ${rs.filter((r) => !r.died).length}) hp${(rs.filter((r) => r.win).reduce((a, r) => a + r.hp, 0) / Math.max(1, rs.filter((r) => r.win).length) * 100).toFixed(0)}%${read}`;
  });
  console.log(`${botName.padEnd(6)} hero-rung ${rung} (${rung === 0 ? (process.env.KIT === 'starter' ? 'starter armour (goblin helmet + shin plates) at Recruit tier' : process.env.KIT === 'goblin' ? `the whole goblin drop set at tier ${process.env.GOBLIN_TIER ?? '0'}` : process.env.RECRUIT === '1' ? 'full plate at Recruit tier' : 'naked') : TIERS[rung]}) vs ${kind} L${level}  wins by pack size  ${row.join('  ')}`);
}
