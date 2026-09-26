// Who took the damage an event carries. `CombatEvent` names its sides by what happened, not by who was hurt (duel.ts): a blow that
// lands (Hit, GuardBroken, Killed) has the one struck as `target`; a defence that succeeds (Blocked, Parried, Dodged) has the DEFENDER
// as `actor` and the attacker as `target`, so the chip a block lets through is taken by `actor`; the lorarii whip names the whipped
// fighter as both. The daily's hits-taken count read `target` for every type and so counted the warden's chip against the player and
// missed the player's own (GPT audit 2026-09-24, finding C). One helper, held by tests/events.test.ts, for every consumer that asks
// "who was hurt": null when nobody was.
import type { CombatEvent, Side } from './duel.ts';

export function struck(e: CombatEvent): Side | null {
  if (!e.damage) return null;
  if (e.type === 'Blocked') return e.actor;
  if (e.type === 'Hit' || e.type === 'GuardBroken' || e.type === 'Killed' || e.type === 'Whipped') return e.target ?? null;
  return null;
}
// The blows a fighter took from the OPPONENT: hits, broken guards and chip through a block. The whip is the wall's, not the warden's.
export const blowsTaken = (log: CombatEvent[], side: Side): number => log.filter(e => e.type !== 'Whipped' && struck(e) === side).length;
