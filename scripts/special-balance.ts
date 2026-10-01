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

export type Special = { pct: number; windup: number; cooldown: number; first: number; cancel?: boolean; interrupt?: boolean };   // interrupt: a landed heavy or guard break in the wind-up staggers him and cancels it (re-arms on the normal cooldown)
export const BOSS: Special = { pct: 0.3, windup: 120, cooldown: 1200, first: 1200 };   // 2 s, 20 s, first use ~20 s in (60 ticks a second)
export type Fx = { winding: boolean };
type Strategy = (d: Duel) => Intent;
const HEAVY = new Set<string>(['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical']);   // src/hud.ts HEAVY_MOVES (the HUD's heavy class)
const forward = (): Intent => ({ ...idle(), move: { x: 0, z: -1, yaw: 0, run: true } });   // yaw 0, z -1 closes on him (probed)
// A fair player's one reaction to the tell: close and hit, instead of whatever the base script was doing.
const aware = (base: Strategy) => (fx: Fx): Strategy => d => (fx.winding ? (gap(d) > 1.5 * k(d) ? forward() : ready(d) ? act('light') : idle()) : base(d));
export const SCRIPTS: Record<string, (fx: Fx, seed: number) => Strategy> = {
  ...Object.fromEntries(Object.entries(STRATEGIES).map(([name, s]) => [name, () => s])),
  'aware: light spam': aware(STRATEGIES['light spam']!), 'aware: turtle and punish': aware(STRATEGIES['turtle and punish']!), 'aware: roll and punish': aware(STRATEGIES['roll and punish']!),
};
export type Fight = { win: boolean; loss: boolean; stall: boolean; ticks: number; windups: number; releases: number; bySpecial: boolean; windKill: boolean; left: number; interrupts: number };
export function fight(opponentId: keyof typeof OPPONENTS, level: number, script: (fx: Fx, seed: number) => Strategy, seed: number, special: Special | null, maxTicks = 7200): Fight {
  const o = opponentAt(OPPONENTS[opponentId], level), profile = profileAt(OPPONENTS[opponentId], level), fx: Fx = { winding: false }, strategy = script(fx, seed);
  let d = arena(o), ai = initialAi((seed * 2654435761) >>> 0), nextAt = special?.first ?? Infinity, windUntil = 0;
  const out: Fight = { win: false, loss: false, stall: false, ticks: 0, windups: 0, releases: 0, bySpecial: false, windKill: false, left: 0, interrupts: 0 };
  for (let i = 0; i < maxTicks && !d.finish; i++) {
    if (special && !fx.winding && d.tick >= nextAt && W(d).phase === 'ready') { fx.winding = true; windUntil = d.tick + special.windup; out.windups++; }
    const w = decide(d, 1, ai, profile); ai = w.ai;
    d = stepDuel(d, [strategy(d), fx.winding ? idle() : w.intent]);   // winding: no guard, no dodge, no swing
    if (fx.winding && special?.cancel && d.events.some(e => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 1)) { fx.winding = false; nextAt = d.tick + special.cooldown; }
    if (fx.winding && special?.interrupt && d.events.some(e => e.target === 1 && (e.type === 'GuardBroken' || (e.type === 'Hit' && (e.charged || HEAVY.has(e.move ?? '')))))) {
      fx.winding = false; nextAt = d.tick + special.cooldown; out.interrupts++;
      if (W(d).health && W(d).phase !== 'hurt') d = { ...d, fighters: [P(d), { ...W(d), phase: 'hurt' as const, age: 0, stun: 40, buffer: null }] };   // staggered even if a poise shrug let the blow through
    }
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
// Mid-skill: the perfect-parry script that answers each swing only with probability p (a seeded coin per swing), so it wins a quarter to two fifths of its fights.
const midParry = (p: number) => (_fx: Fx, seed: number): Strategy => {
  let r = (seed * 2246822519) >>> 0; const rnd = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296, memo = new Map<number, boolean>();
  return d => { const w = W(d); if (w.phase === 'attack' && w.move && !w.landed && ready(d)) { const key = d.tick - w.age; let ok = memo.get(key); if (ok === undefined) memo.set(key, ok = rnd() < p); if (!ok) return idle(); } return STRATEGIES['perfect parry']!(d); };
};
// The one reaction a fair player has to the tell once an interrupt exists: close and hit HEAVY (a heavy or a guard break interrupts; a light does not).
const rush = (base: (fx: Fx, seed: number) => Strategy) => (fx: Fx, seed: number): Strategy => { const b = base(fx, seed); return d => (fx.winding ? (gap(d) > 1.5 * k(d) ? forward() : ready(d) ? act('heavy') : idle()) : b(d)); };
const mastery = () => STRATEGIES['perfect parry']!;
export const BOTS = (p: number): Record<string, (fx: Fx, seed: number) => Strategy> => ({ mastery, 'mastery+rush': rush(mastery), mid: midParry(p), 'mid+rush': rush(midParry(p)) });
export const VARIANTS: Record<string, Special | null> = { none: null, boss30: BOSS, boss30early: { ...BOSS, first: 600 }, boss20: { ...BOSS, pct: 0.2 }, boss30cancel: { ...BOSS, cancel: true } };
export const INTERRUPT_VARIANTS: Record<string, Special | null> = { none: null, 'b30@20 no-int': BOSS, 'b30@20 int': { ...BOSS, interrupt: true }, 'b30@15 no-int': { ...BOSS, first: 900 }, 'b30@15 int': { ...BOSS, first: 900, interrupt: true } };
if (process.argv[1]?.endsWith('special-balance.ts') && process.argv[4] === 'interrupt') {   // node scripts/special-balance.ts <id> <seeds> interrupt <p>
  const id = process.argv[2] as keyof typeof OPPONENTS, seeds = Number(process.argv[3]), bots = BOTS(Number(process.argv[5] ?? 0.5)), table: Record<string, Fight[]> = {};
  for (const rank of [8, 9, 10]) for (const [vname, special] of Object.entries(INTERRUPT_VARIANTS)) for (const [bname, bot] of Object.entries(bots))
    table[`${rank}|${vname}|${bname}`] = Array.from({ length: seeds }, (_, s) => fight(id, rungTopLevel(rank), bot, s + 1, special));
  console.log(JSON.stringify({ id, seeds, table }));
} else if (process.argv[1]?.endsWith('special-balance.ts')) {
  const id = process.argv[2] as keyof typeof OPPONENTS, seeds = Number(process.argv[3] ?? 24), table: Record<string, Fight[]> = {};
  for (const rank of [8, 9, 10]) for (const [vname, special] of Object.entries(VARIANTS)) for (const [sname, script] of Object.entries(SCRIPTS))
    table[`${rank}|${vname}|${sname}`] = Array.from({ length: seeds }, (_, s) => fight(id, rungTopLevel(rank), script, s + 1, special));
  console.log(JSON.stringify({ id, seeds, rules: RULES.health, table }));
}
