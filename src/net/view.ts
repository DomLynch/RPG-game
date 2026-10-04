// The duel as one side sees it (docs/duel-architecture.md §7). The scene, the HUD, the audio and combat.ts's project() all assume the
// player is side 0; the guest of a PvP duel is side 1. viewAs swaps the fighters and flips every event's sides and the finish's victim, so
// the guest's page draws the same fight from its own chair with no change to any of them. Presentation only: the rollback session steps
// the real duel, never this view. Positions stay world positions (each fighter keeps its own body), so both pages show one ring.
import type { CombatEvent, Duel, Side } from '../duel.ts';

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

const flipEvent = (e: CombatEvent): CombatEvent => (e.target === undefined ? { ...e, actor: other(e.actor) } : { ...e, actor: other(e.actor), target: other(e.target) });

export function viewAs(duel: Duel, side: Side): Duel {
  if (side === 0) return duel;
  return {
    tick: duel.tick,
    fighters: [duel.fighters[1], duel.fighters[0]],
    finish: duel.finish && { ...duel.finish, victim: other(duel.finish.victim) },
    events: duel.events.map(flipEvent),
  };
}
