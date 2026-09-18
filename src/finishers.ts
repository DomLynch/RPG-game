import type { Finish } from './duel.ts';
import type { WeaponId } from './moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17, GAME_SPEC "Owner-authorized finishers & gore"). The simulation decided
// the kill already: selection is a pure function of the Killed event's data (victim, location, move, heading) and the
// fighters' weapons — it consumes no simulation state, no wall clock, no randomness, so the same duel replays the same
// finisher. v1 has no weapon-dependent row (one table for every weapon); the weapons argument pins the contract for the
// per-weapon rows a later pass may add. Presentation falls back to the plain Death clip for any finisher whose clip has
// not shipped yet (ship order: Split Crown end-to-end first, then the set).
export type FinisherId = 'splitCrown' | 'runThrough' | 'quietOne' | 'opened' | 'hamstrung' | 'execution';

export function selectFinisher(finish: Finish, weapons: readonly [WeaponId, WeaponId]): FinisherId | null {
  void weapons;   // v1: one table for every weapon — the parameter pins the contract for the per-weapon rows a later pass may add
  if (finish.draw) return null;                  // a double fall gets no ceremony
  if (finish.victim === 0) return null;          // the player's own death keeps the plain fall (v2 review)
  if (finish.move === 'kick') return null;       // kicked to death: no blade, no blade closer, no blood (2026-09-13)
  // Owner rule 2026-09-18 (recorded on PR #112, broadened same day after the owner's live playtest): ANY blade kill plays
  // the finisher — light cut, thrust, riposte, heavy, critical, whatever the sim reports — universal across weapons and
  // characters. Nobody aims in this game, so gating the showpiece behind a blow type the player can't feel guaranteed it
  // never played. v1 ships Split Crown alone; the remaining universal finishers join a deterministic rotation pool seeded
  // from the kill event (never wall-clock randomness — same duel, same finisher); weapon/class-specific specials come
  // later as a separate layer.
  return 'splitCrown';
}

// Which rigs carry which finisher clip today. null = the plain Death plays until the clip lands (ship order: Split Crown
// end-to-end first, then the set). The pose word is what characters.ts `update` understands.
export const FINISHER_POSE: Record<FinisherId, 'splitCrown' | null> = {
  splitCrown: 'splitCrown',
  runThrough: null,
  quietOne: null,
  opened: null,
  hamstrung: null,
  execution: null,
};
