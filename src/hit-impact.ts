// Hit impact (Dom 2026-09-29, "yes, this is good" on the ?look=hitfx-impact clip): every LANDED blow adds to the hit-stop and knocks the
// camera away from it. Presentation only: the hit-stop is main.ts's presentation pause (every tick still runs, in order, so records and
// replays are unchanged) and the knock is a camera-kick Shove. Blocked, parried and missed blows add nothing. Both off under
// prefers-reduced-motion (the camera rig drops every shove there; the stop is gated here).
//   full: a heavy (the heavy class or a charged blow), a guard break, a skill or special (`skill_*`): +5 frames, 4 cm
//   half: every other landed hit (a stab, a slash, a kick):                                              +3 frames, 2 cm
import { HEAVY_CLASS } from './clash-sparks.ts';
import { shoveFor, type Shove } from './camera-kick.ts';
import type { CombatEvent } from './duel.ts';
import type { Direction } from './moves.ts';

export type Tier = 'full' | 'half';
export const IMPACT = { full: { frames: 5, knock: 0.04 }, half: { frames: 3, knock: 0.02 } } as const;
export const KNOCK_SETTLE = 0.12;   // seconds: the knock is back in 120 ms

export function impactTier(e: CombatEvent): Tier | null {
  if (e.type === 'GuardBroken') return 'full';
  if (e.type !== 'Hit') return null;
  return e.charged || HEAVY_CLASS.has(e.move ?? '') || e.move?.startsWith('skill_') ? 'full' : 'half';
}

// Milliseconds added to the frame's hit-stop: the strongest landed blow of the frame decides.
export function impactStopMs(events: readonly CombatEvent[], reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  let frames = 0;
  for (const e of events) { const tier = impactTier(e); if (tier) frames = Math.max(frames, IMPACT[tier].frames); }
  return (frames * 1000) / 60;
}

// The knock, AWAY from the side the blow arrives from on screen. `screen` is metres along the camera's right (+ = right); 4 cm is ~2.5 %
// of a 375-wide portrait frame at duel distance (~3.5 m, 25° across). The move's direction is the attacker's side; the camera sits behind
// the player, so a blow on the player arrives mirrored (right -> from screen left: the camera goes right) and a blow on the opponent
// arrives as named (right -> from screen right: the camera goes left). An overhead, a thrust, a low blow, a kick or a skill with no side
// arrives from above or in front: the camera drops by the knock instead. `null`: not a landed blow, today's kick stands.
export function impactShove(e: CombatEvent, direction: Direction | undefined): Shove | null {
  const tier = impactTier(e), base = shoveFor(e);
  if (!tier || !base || e.target === undefined) return null;
  const knock = IMPACT[tier].knock, lateral = direction === 'right' || direction === 'left';
  const from = lateral ? ((direction === 'right') === (e.target === 1) ? 1 : -1) : 0;   // +1: the blow arrives from screen right
  return { ...base, drop: base.drop + (lateral ? 0 : knock), screen: -from * knock, hold: 0, settle: KNOCK_SETTLE };
}
