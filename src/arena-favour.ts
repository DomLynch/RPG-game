// Crowd favour (World lane, Dom/COO 2026-10-07): the Pit crowd roars when the hero fights with style. PRESENTATION ONLY: it reads the combat events the arena already receives and
// moves the crowd; it gives no stat, no damage, no stamina, no unlock and touches no sim file (src/duel.ts, sim.ts, combat.ts are read-only here). Pure, so it is testable without three.
// Style is what a crowd would cheer, scored per event by the hero (side 0): a parry, a perfect defence, a feint, a counter, a kill. Favour builds, decays, and at the roar line the
// crowd roars once, then favour drops so it takes another run of style to roar again (a chain, not a constant).
import type { CombatEvent } from './combat.ts';

export const FAVOUR = {
  hero: 0 as const,
  decay: 0.4,          // per second: a pause in the style lets the crowd settle
  roarAt: 1,           // favour that makes the crowd roar
  afterRoar: 0.2,      // what is left once it has
  roarSeconds: 1.6,    // how long the roar lasts (arena.ts reaction curve)
  weights: { parry: 0.5, perfect: 0.4, feint: 0.25, counter: 0.35, kill: 0.6 },
} as const;

// What one event is worth to the crowd (0 = nothing): the hero's own style only, never the enemy's.
export function styleOf(e: CombatEvent): number {
  const W = FAVOUR.weights, hero = FAVOUR.hero;
  if (e.type === 'Parried' && e.actor === hero) return W.parry + (e.perfect ? W.perfect : 0);
  if (e.type === 'Dodged' && e.actor === hero && e.perfect) return W.perfect;
  if (e.type === 'ActionStarted' && e.actor === hero && e.action === 'feint') return W.feint;
  if (e.type === 'Hit' && e.actor === hero && e.counter) return W.counter;
  if (e.type === 'Killed' && e.actor === hero) return W.kill;
  return 0;
}

// One frame: decay, add the events' style, and say whether the crowd roars now (the rising edge across the roar line).
export function stepFavour(favour: number, events: readonly CombatEvent[], dt: number): { favour: number; roar: boolean } {
  let f = Math.max(0, favour - FAVOUR.decay * dt);
  for (const e of events) f += styleOf(e);
  if (f >= FAVOUR.roarAt) return { favour: FAVOUR.afterRoar, roar: true };
  return { favour: f, roar: false };
}
