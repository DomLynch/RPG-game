import { RULES, SKILL_MOVE } from './moves.ts';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { SPECIAL_RECOVER } from './special-look.ts';   // Combat's: the caster's return to stance runs on the same 45 ticks

// Hades' Shadow Claw, the presentation timeline (Finishers with Combat, 2026-09-29; brief docs/briefs/special-moves-hades-pilot.md). Three-free,
// like special-look.ts beside it. Ticks at the sim's 60 Hz from the SpecialStarted tick: the strike
// lands on SpecialLanded at start + RULES.special.windup − 1 (the cast tick counts), so the windup stays the one source of the 120.
export const CLAW_FORM = 18, CLAW_FALL = 12;
export { SPECIAL_RECOVER };
export const LAND_AT = RULES.special.windup - 1;
export const FORM_AT = LAND_AT - CLAW_FALL - CLAW_FORM, FALL_AT = LAND_AT - CLAW_FALL;

// Which cast gets the claw: Hades is the Nightborn's rank-9 boss, the opponent's side, on his class skill. Every other special draws nothing
// until it has its own art.
export const isShadowClaw = (opponent: OpponentId, actor: number, move?: string) => opponent === 'nightborn' && actor === 1 && move === 'skill_lunge';

export type SpecialKind = 'hades' | 'set';   // which art draws the cast; the timeline below is the same for both (the one 120)
export type Cast = { actor: number; start: number; landed: number | null; fizzled: number | null };
export type ClawPhase = { phase: 'gather' | 'form' | 'fall' | 'recover' | 'dissolve' | 'done'; k: number; age: number };

// Where a cast is at sim time `now` (fractional ticks allowed): the cloud gathers from the start, the claw forms inside it, then falls onto the
// head on the landing tick; after SpecialLanded the cloud tears away, after SpecialFizzled it dissolves with no claw. k runs 0..1 in each phase.
export function clawPhase(cast: Cast, now: number): ClawPhase {
  const end = cast.landed ?? cast.fizzled;
  if (end !== null) {
    const age = now - end, k = age / SPECIAL_RECOVER;
    return { phase: k >= 1 ? 'done' : cast.landed !== null ? 'recover' : 'dissolve', k: Math.min(1, Math.max(0, k)), age };
  }
  const age = now - cast.start;
  if (age < FORM_AT) return { phase: 'gather', k: Math.max(0, age / FORM_AT), age };
  if (age < FALL_AT) return { phase: 'form', k: (age - FORM_AT) / CLAW_FORM, age };
  return { phase: 'fall', k: Math.min(1, (age - FALL_AT) / CLAW_FALL), age };   // held at the head until the landing event arrives
}

// Fold one frame of sim events (and the fighters' own windup counters, so a cast begun before the effect loaded still draws) into the cast.
export function advanceCast(cast: Cast | null, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, opponent: OpponentId, yielding: boolean): Cast | null {
  for (const event of events) {
    const e = event as CombatEvent & { actor?: number; move?: string };
    if (e.type === 'SpecialStarted' && !yielding && isShadowClaw(opponent, e.actor ?? -1, e.move)) cast = { actor: e.actor!, start: e.tick, landed: null, fizzled: null };
    else if (cast && e.actor === cast.actor && cast.landed === null && cast.fizzled === null) {
      if (e.type === 'SpecialLanded') cast = { ...cast, landed: e.tick };
      else if (e.type === 'SpecialFizzled') cast = { ...cast, fizzled: e.tick };
    }
  }
  const caster = fighters[1];
  if (!cast && !yielding && caster.special && isShadowClaw(opponent, 1, caster.skill ? SKILL_MOVE[caster.skill] : undefined))
    cast = { actor: 1, start: tick - (RULES.special.windup - caster.special), landed: null, fizzled: null };
  return cast && clawPhase(cast, tick).phase === 'done' ? null : cast;
}
// Red Wind reads the same phases under its own names: gather = the low spiral, form = it tightens, fall = it snaps into a column, recover = the scour and the rain.
export const castPhase = clawPhase;
