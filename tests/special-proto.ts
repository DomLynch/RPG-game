// Special Moves, prototype rule for the numbers (Lead's brief, 2026-09-29): a test-layer wrapper around stepDuel, OFF the sim. Nothing in
// src/ changes, so SIM_DIGEST, RECORD_VERSION and every record replay exactly as before; the Thor pilot moves the rule into duel.ts with the bump.
// The rule: one special per fighter, cast from `ready` inside `reach`, a `windup`-tick tell during which the caster stands and tracks,
// then it resolves UNBLOCKABLE (no guard, parry or block applies) for `damage` × the target's max health. Dodged only by a roll whose
// i-frames (RULES.safeStart..safeEnd) cover the contact tick, or by being out of `reach` / outside `arc` at that tick. A blow that
// staggers or kills the caster during the tell cancels it; the cooldown is spent at commitment (as RULES.skillCooldown is), and the
// first cast is available `first` ticks into the fight.
// Who dodges: each side answers the other's tell with a roll pressed on a noticed-then-aimed tick (reaction, lapse, accuracy). The AI
// uses its own profile's numbers; the scripted player uses PLAYER_DODGE (an assumption, a typical thumb, stated in the report).
// Deterministic: a separate seeded LCG per fight, so the AI's own stream (initialAi) is untouched; the sim's geometry through detmath.
import { decide, initialAi } from '../src/ai.ts';
import { legal, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { RULES, opponentAt, profileAt, type AiProfile, type Opponent } from '../src/moves.ts';
import { M } from '../src/detmath.ts';
import { wrapAngle } from '../src/sim.ts';
import { arena, idle } from './strategies.ts';

export type SpecialRule = { windup: number; cooldown: number; first: number; reach: number; arc: number; damage: number };
// The brief's numbers at 60 Hz: ~0.7 s tell, 20 s cooldown, first at 20 s, 15 % of max health. Reach 3.0 m: past every thrust's 2.3 (mid-range).
export const SPECIAL: SpecialRule = { windup: 42, cooldown: 1200, first: 1200, reach: 3, arc: Math.PI / 4, damage: .15 };
export type Dodger = { reaction: number; lapse: number; accuracy: number };
export const PLAYER_DODGE: Dodger = { reaction: 15, lapse: .25, accuracy: .7 };
const aiDodger = (p: AiProfile): Dodger => ({ reaction: Math.min(p.reaction, p.tellReaction ?? p.reaction), lapse: p.lapse, accuracy: p.accuracy });

type Side = 0 | 1;
export type SpecialTally = { cast: number; landed: number; dodged: number; outranged: number; cancelled: number; kills: number };
export type FightResult = { outcome: 'win' | 'loss' | 'stall'; ticks: number; specialKill: boolean; player: SpecialTally; ai: SpecialTally };
const tally = (): SpecialTally => ({ cast: 0, landed: 0, dodged: 0, outranged: 0, cancelled: 0, kills: 0 });
const lcg = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// One fight: tests/strategies.ts battery()'s loop (the same arena, AI seed and step) with the day-one Pommel carried, as the ladder battery
// does; with `rule` null it is that battery's fight, unchanged.
export function fight(level: number, seed: number, opponent: Opponent, strategy: (d: Duel) => Intent, rule: SpecialRule | null, ticks = 7200): FightResult {
  const profile = profileAt(opponent, level), dodgers: [Dodger, Dodger] = [PLAYER_DODGE, aiDodger(profile)], rnd = lcg(seed * 40503 + 7);
  let d = arena(opponentAt(opponent, level), 'longsword', 'pommel'), ai = initialAi((seed * 2654435761) >>> 0), specialKill = false;
  const cd = [rule?.first ?? 0, rule?.first ?? 0], wind = [0, 0], dodgeAt = [-1, -1], tallies: [SpecialTally, SpecialTally] = [tally(), tally()];
  for (let i = 0; i < ticks && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    const intents: [Intent, Intent] = [strategy(d), w.intent];
    if (rule) {
      const gap = M.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
      for (const s of [0, 1] as const) {
        const f = d.fighters[s], o = (1 - s) as Side;
        if (!wind[s] && !cd[s] && f.phase === 'ready' && f.health > 0 && gap <= rule.reach) {
          // Cast whenever it is ready and in reach: the upper bound on how often a special can matter. The target schedules its answer now.
          wind[s] = rule.windup; cd[s] = rule.cooldown; tallies[s].cast++;
          const dg = dodgers[o], contact = d.tick + 1 + rule.windup;
          const aim = contact - Math.round((RULES.safeStart + RULES.safeEnd) / 2), err = Math.round((1 - dg.accuracy) * 16 * (rnd() * 2 - 1));
          dodgeAt[o] = rnd() < dg.lapse ? -1 : Math.max(d.tick + 1 + dg.reaction, aim + err);
        }
        if (wind[s]) intents[s] = idle();   // the tell: standing, tracking the target, no guard
      }
      for (const s of [0, 1] as const) if (!wind[s] && dodgeAt[s] === d.tick + 1 && legal(d.fighters[s], 'dodge')) intents[s] = { ...idle(), action: 'dodge' };
    }
    d = stepDuel(d, intents);
    if (!rule) continue;
    for (const s of [0, 1] as const) {
      cd[s] = Math.max(0, cd[s] - 1);
      if (!wind[s]) continue;
      const A = d.fighters[s], o = (1 - s) as Side, D = d.fighters[o];
      if (A.phase === 'hurt' || A.phase === 'dead') { wind[s] = 0; dodgeAt[o] = -1; tallies[s].cancelled++; continue; }
      if (--wind[s]) continue;
      dodgeAt[o] = -1;
      if (!D.health || d.finish) continue;
      const far = M.hypot(A.body.x - D.body.x, A.body.z - D.body.z) > rule.reach || Math.abs(wrapAngle(M.atan2(D.body.x - A.body.x, D.body.z - A.body.z) - A.body.heading)) >= rule.arc;
      if (D.phase === 'roll' && D.age >= RULES.safeStart && D.age <= RULES.safeEnd) { tallies[s].dodged++; continue; }
      if (far) { tallies[s].outranged++; continue; }
      tallies[s].landed++;
      D.health = Math.max(0, D.health - Math.round(rule.damage * D.maxHealth));
      if (!D.health) { D.phase = 'dead'; D.age = 0; D.stun = RULES.death; tallies[s].kills++; specialKill = true; d = { ...d, finish: { victim: o, location: 'torso', move: 'kick', heading: A.body.heading } }; }
    }
  }
  const outcome = !d.finish ? 'stall' : !d.finish.draw && d.finish.victim === 1 ? 'win' : 'loss';
  return { outcome, ticks: d.tick, specialKill, player: tallies[0], ai: tallies[1] };
}

// Paired OFF / ON over the same seeds: `flipped` counts fights whose outcome the special changed, the direct "decides the fight" measure.
export type Cell = { fights: number; winsOff: number; winsOn: number; ticksOff: number; ticksOn: number; finishedOff: number; finishedOn: number; flipped: number; specialKills: number; player: SpecialTally; ai: SpecialTally };
export function cell(level: number, seeds: number, opponent: Opponent, strategies: Record<string, (d: Duel) => Intent>, rule: SpecialRule = SPECIAL): Cell {
  const c: Cell = { fights: 0, winsOff: 0, winsOn: 0, ticksOff: 0, ticksOn: 0, finishedOff: 0, finishedOn: 0, flipped: 0, specialKills: 0, player: tally(), ai: tally() };
  for (const strategy of Object.values(strategies)) for (let s = 1; s <= seeds; s++) {
    const off = fight(level, s, opponent, strategy, null), on = fight(level, s, opponent, strategy, rule);
    c.fights++; c.winsOff += +(off.outcome === 'win'); c.winsOn += +(on.outcome === 'win');
    if (off.outcome !== 'stall') { c.finishedOff++; c.ticksOff += off.ticks; }
    if (on.outcome !== 'stall') { c.finishedOn++; c.ticksOn += on.ticks; }
    c.flipped += +(off.outcome !== on.outcome); c.specialKills += +on.specialKill;
    for (const k of Object.keys(c.player) as (keyof SpecialTally)[]) { c.player[k] += on.player[k]; c.ai[k] += on.ai[k]; }
  }
  return c;
}
