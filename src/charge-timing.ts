import { CAST_MARGIN, LAND_AT, type Cast } from './special-timing.ts';
import { SPECIAL_RECOVER } from './special-look.ts';

// The Centurion's Charge (Alexander, his rank-9 boss special), the presentation timeline (World, 2026-10-01; Strategy's brief
// docs/briefs/specials/centurion-l8-l10-2026-10-01.md). Three-free, like nightfall-timing.ts, whose Cast it reads. No horse: for the last RACE ticks
// of the windup a line of dust races along the ground and reaches the target on the landing tick (the blow); then the dust hangs and settles
// over SETTLE ticks. A fizzle (the caster fell) stops the race where it is and thins it in DISSOLVE ticks; a cast whose end event never comes is
// treated as a fizzle at LAND_AT + CAST_MARGIN, as nightfall-timing.ts does. Nothing here touches the sim.
export const RACE = 36;   // ticks of visible build-up, 0.6 s: the brief's 0.4–0.6 s (a slow 1–2 s build-up was rejected on Red Wind)
export const RACE_FROM = LAND_AT - RACE, SETTLE = SPECIAL_RECOVER, DISSOLVE = 20, STUCK_AT = LAND_AT + CAST_MARGIN;

// The Centurion is the rank-9 boss of his own ladder and casts his class skill, the Scutum Shove: the shield charge.
export const isCharge = (opponent: string, actor: number, move?: string) => opponent === 'veteran' && actor === 1 && move === 'skill_shove';

// `front` 0..1: how far the dust has raced (eased in: a gallop gathers speed). `settle` 0..1 after the landing (null before). `fade` 1..0 on a fizzle.
// Null when nothing is drawn.
export type Charge = { front: number; settle: number | null; fade: number };
export function charge(cast: Cast, now: number): Charge | null {
  const age = now - cast.start, run = (at: number) => Math.min(1, Math.max(0, (at - RACE_FROM) / RACE)) ** 1.5;
  const end = cast.landed ?? cast.fizzled ?? (age >= STUCK_AT ? cast.start + STUCK_AT : null);
  if (end === null) return age < RACE_FROM ? null : { front: run(age), settle: null, fade: 1 };
  const since = now - end;
  if (cast.landed !== null) return since >= SETTLE ? null : { front: 1, settle: Math.max(0, since / SETTLE), fade: 1 };
  const frozen = run(end - cast.start);
  return frozen === 0 || since >= DISSOLVE ? null : { front: frozen, settle: null, fade: 1 - Math.max(0, since / DISSOLVE) };
}
