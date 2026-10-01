import { RULES, SKILL_MOVE } from './moves.ts';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { SPECIAL_RECOVER } from './special-look.ts';   // Combat's: the caster's return to stance runs on the same 45 ticks

// Hades' Shadow, the presentation timeline (Finishers with Combat, 2026-09-29; brief docs/briefs/special-moves-hades-pilot.md). Three-free,
// like special-look.ts beside it. Ticks at the sim's 60 Hz from the SpecialStarted tick: the strike
// lands on SpecialLanded at start + RULES.special.windup − 1 (the cast tick counts), so the windup stays the one source of the 120.
export const DROP_TICKS = 24;   // the cloud's drop onto the head, ending on the landing tick
export { SPECIAL_RECOVER };
export const LAND_AT = RULES.special.windup - 1;
export const FALL_AT = LAND_AT - DROP_TICKS;
// A wind-up that releases on an already-dead target ends with no sim event (Auditer P3 on #1186): every cast has a hard timeout, wind-up + recover + this
// margin, after which it force-ends and the effect restores, so a cast with no end never holds its effect into the next fight.
export const CAST_MARGIN = 60;

// Which cast gets the shadow: Hades is the Nightborn's rank-9 boss, the opponent's side, on his class skill. Every other special draws nothing
// until it has its own art.
export const isHadesShadow = (opponent: OpponentId, actor: number, move?: string) => opponent === 'nightborn' && actor === 1 && move === 'skill_lunge';

export type Cast = { actor: number; start: number; landed: number | null; fizzled: number | null };
export type ShadowPhase = { phase: 'gather' | 'fall' | 'recover' | 'dissolve' | 'done'; k: number; age: number };

// Where a cast is at sim time `now` (fractional ticks allowed): the cloud gathers above the head from the start, drops onto it so it arrives on the
// landing tick; after SpecialLanded it covers the head, then thins and clears, after SpecialFizzled it dissolves where it hangs. k runs 0..1 in each phase.
export function shadowPhase(cast: Cast, now: number): ShadowPhase {
  const end = cast.landed ?? cast.fizzled;
  if (end !== null) {
    const age = now - end, k = age / SPECIAL_RECOVER;
    return { phase: k >= 1 ? 'done' : cast.landed !== null ? 'recover' : 'dissolve', k: Math.min(1, Math.max(0, k)), age };
  }
  const age = now - cast.start;
  if (age >= LAND_AT + SPECIAL_RECOVER + CAST_MARGIN) return { phase: 'done', k: 1, age };
  if (age < FALL_AT) return { phase: 'gather', k: Math.max(0, age / FALL_AT), age };
  return { phase: 'fall', k: Math.min(1, (age - FALL_AT) / DROP_TICKS), age };   // held at the head until the landing event arrives
}

// Fold one frame of sim events (and the fighters' own windup counters, so a cast begun before the effect loaded still draws) into the cast.
// `is`: which cast the effect is for. Hades' Shadow by default; another move's effect passes its own test (opponent, actor, move id), so a lane adds its special
// without editing this timeline.
export function advanceCast(cast: Cast | null, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, opponent: OpponentId, yielding: boolean, is: typeof isHadesShadow = isHadesShadow): Cast | null {
  for (const event of events) {
    const e = event as CombatEvent & { actor?: number; move?: string };
    if (e.type === 'SpecialStarted' && !yielding && is(opponent, e.actor ?? -1, e.move)) cast = { actor: e.actor!, start: e.tick, landed: null, fizzled: null };
    else if (cast && e.actor === cast.actor && cast.landed === null && cast.fizzled === null) {
      if (e.type === 'SpecialLanded') cast = { ...cast, landed: e.tick };
      else if (e.type === 'SpecialFizzled') cast = { ...cast, fizzled: e.tick };
    }
  }
  const caster = fighters[1];
  if (!cast && !yielding && caster.special && is(opponent, 1, caster.skill ? SKILL_MOVE[caster.skill] : undefined))
    cast = { actor: 1, start: tick - (RULES.special.windup - caster.special), landed: null, fizzled: null };
  return cast && shadowPhase(cast, tick).phase === 'done' ? null : cast;
}
