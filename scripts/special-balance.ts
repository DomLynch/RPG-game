// Boss-special balance sweep (Strategy 2026-10-01): analysis only, no sim change. A stub layered over stepDuel applies Dom's numbers
// to the caster (fighter 1): unblockable + undodgeable once released, a WINDUP-tick wind-up in which he can neither block nor dodge
// (his intent is idle) and takes ordinary hits, `pct` of the PLAYER's max health on release, COOLDOWN ticks between uses, first use at FIRST.
// The special is not interrupted by a hit (the brief says he "takes normal hits", nothing about a cancel); `cancel` runs that variant.
// The scripted strategies are tests/strategies.ts; "aware" ones add the one reaction a fair player has: rush the caster while he winds up.
// Run: node scripts/special-balance.ts <opponentId> [seeds]   (prints one JSON line)
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { OPPONENTS, opponentAt, profileAt, RULES } from '../src/moves.ts';
import { rungTopLevel } from '../src/legends.ts';
import { STRATEGIES, act, arena, gap, idle, k, ready, P, W } from '../tests/strategies.ts';

export type Special = { pct: number; windup: number; cooldown: number; first: number; cancel?: boolean };
export const BOSS: Special = { pct: 0.3, windup: 120, cooldown: 1200, first: 1200 };   // 2 s, 20 s, first use ~20 s in (60 ticks a second)
export type Fx = { winding: boolean };
type Strategy = (d: Duel) => Intent;
const forward = (): Intent => ({ ...idle(), move: { x: 0, z: -1, yaw: 0, run: true } });   // yaw 0, z -1 closes on him (probed)
// A fair player's one reaction to the tell: close and hit, instead of whatever the base script was doing.
const aware = (base: Strategy) => (fx: Fx): Strategy => d => (fx.winding ? (gap(d) > 1.5 * k(d) ? forward() : ready(d) ? act('light') : idle()) : base(d));
export const SCRIPTS: Record<string, (fx: Fx) => Strategy> = {
  ...Object.fromEntries(Object.entries(STRATEGIES).map(([name, s]) => [name, () => s])),
  'aware: light spam': aware(STRATEGIES['light spam']!), 'aware: turtle and punish': aware(STRATEGIES['turtle and punish']!), 'aware: roll and punish': aware(STRATEGIES['roll and punish']!),
};
export type Fight = { win: boolean; loss: boolean; stall: boolean; ticks: number; windups: number; releases: number; bySpecial: boolean; windKill: boolean; left: number };
export function fight(opponentId: keyof typeof OPPONENTS, level: number, script: (fx: Fx) => Strategy, seed: number, special: Special | null, maxTicks = 7200): Fight {
  const o = opponentAt(OPPONENTS[opponentId], level), profile = profileAt(OPPONENTS[opponentId], level), fx: Fx = { winding: false }, strategy = script(fx);
  let d = arena(o), ai = initialAi((seed * 2654435761) >>> 0), nextAt = special?.first ?? Infinity, windUntil = 0;
  const out: Fight = { win: false, loss: false, stall: false, ticks: 0, windups: 0, releases: 0, bySpecial: false, windKill: false, left: 0 };
  for (let i = 0; i < maxTicks && !d.finish; i++) {
    if (special && !fx.winding && d.tick >= nextAt && W(d).phase === 'ready') { fx.winding = true; windUntil = d.tick + special.windup; out.windups++; }
    const w = decide(d, 1, ai, profile); ai = w.ai;
    d = stepDuel(d, [strategy(d), fx.winding ? idle() : w.intent]);   // winding: no guard, no dodge, no swing
    if (fx.winding && special?.cancel && d.events.some(e => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 1)) { fx.winding = false; nextAt = d.tick + special.cooldown; }
    if (fx.winding && d.finish && d.finish.victim === 1 && !d.finish.draw) out.windKill = true;
    if (fx.winding && !d.finish && d.tick >= windUntil && special) {   // release: unblockable, undodgeable, whatever the player is doing
      const hurt = Math.round(special.pct * P(d).maxHealth), health = Math.max(0, P(d).health - hurt);
      d = { ...d, fighters: [{ ...P(d), health, ...(health ? {} : { phase: 'dead' as const }) }, W(d)] };
      out.releases++; fx.winding = false; nextAt = d.tick + special.cooldown;
      if (!health) { d = { ...d, finish: { victim: 0, location: 'torso', move: 'heavy', heading: 0 } }; out.bySpecial = true; }
    }
  }
  out.ticks = d.tick; out.left = P(d).health;
  if (!d.finish) out.stall = true; else if (d.finish.draw || d.finish.victim === 0) out.loss = true; else out.win = true;
  return out;
}
export const VARIANTS: Record<string, Special | null> = { none: null, boss30: BOSS, boss30early: { ...BOSS, first: 600 }, boss20: { ...BOSS, pct: 0.2 }, boss30cancel: { ...BOSS, cancel: true } };
if (process.argv[1]?.endsWith('special-balance.ts')) {
  const id = process.argv[2] as keyof typeof OPPONENTS, seeds = Number(process.argv[3] ?? 24), table: Record<string, Fight[]> = {};
  for (const rank of [8, 9, 10]) for (const [vname, special] of Object.entries(VARIANTS)) for (const [sname, script] of Object.entries(SCRIPTS))
    table[`${rank}|${vname}|${sname}`] = Array.from({ length: seeds }, (_, s) => fight(id, rungTopLevel(rank), script, s + 1, special));
  console.log(JSON.stringify({ id, seeds, rules: RULES.health, table }));
}
