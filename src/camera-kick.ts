import { HEAVY_CLASS } from './clash-sparks.ts';
import type { CombatEvent } from './duel.ts';
import type { Direction } from './moves.ts';

// Presentation only: what a contact does to the camera. A landing blow drops the camera and shoves it a little along the blow; a block
// rocks it less; a parry flicks it sideways with the deflection. Metres, seconds. Readable brutality: the frame shifts by a few pixels
// and settles in under a quarter second — the guard shudders, the screen never shakes. `null`: this event moves nothing.
export type Shove = { along: number; drop: number; side: number; hold: number; settle: number; screen?: number };
export function shoveFor(event: CombatEvent): Shove | null {
  const heavy = !!event.charged || HEAVY_CLASS.has(event.move ?? '');
  switch (event.type) {
    case 'GuardBroken': return { along: 0.05, drop: 0.06, side: 0, hold: 2 / 60, settle: 0.22 };
    case 'Hit': return heavy ? { along: 0.05, drop: 0.06, side: 0, hold: 2 / 60, settle: 0.22 } : { along: 0.02, drop: 0.012, side: 0, hold: 0, settle: 0.15 };
    case 'Parried': return { along: 0.01, drop: 0.008, side: event.move === 'light_left' ? -0.02 : 0.02, hold: 0, settle: 0.12 };
    case 'Blocked': return heavy ? { along: 0.02, drop: 0.028, side: 0, hold: 1 / 60, settle: 0.18 } : { along: 0.012, drop: event.perfect ? 0.014 : 0.01, side: 0, hold: 0, settle: 0.12 };
    default: return null;
  }
}

// `?look=hitfx-impact`: on a heavy hit or a guard break the camera is knocked AWAY from the side the blow arrives from on screen, ~2.5 % of a
// 375-wide portrait frame at duel distance (4 cm at ~3.5 m, 25° across), full on the contact frame and back in 120 ms. `screen` is metres
// along the camera's right (+ = right). The blow's side: the move's direction is the attacker's side; the camera sits behind the player,
// so a blow on the player arrives mirrored (right -> screen left) and a blow on the opponent arrives as named. Overhead, thrust and low
// arrive from above or in front: the camera drops instead. Other contacts: `null`, today's kick.
export const IMPACT_SCREEN = 0.04, IMPACT_SETTLE = 0.12;
export function impactShove(event: CombatEvent, direction: Direction | undefined): Shove | null {
  const heavy = !!event.charged || HEAVY_CLASS.has(event.move ?? '');
  if (!(event.type === 'GuardBroken' || (event.type === 'Hit' && heavy)) || event.target === undefined) return null;
  const base = shoveFor(event)!, lateral = direction === 'right' || direction === 'left';
  const from = lateral ? ((direction === 'right') === (event.target === 1) ? 1 : -1) : 0;   // +1: the blow arrives from screen right
  return { ...base, drop: base.drop + (lateral ? 0 : IMPACT_SCREEN), screen: -from * IMPACT_SCREEN, hold: 0, settle: IMPACT_SETTLE };
}
