import type { Finish } from './duel.ts';
import type { MoveId, WeaponId } from './moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17, GAME_SPEC "Owner-authorized finishers & gore"). The simulation decided
// the kill already: selection is a pure function of the Killed event's data (victim, location, move, heading) and the
// fighters' weapons — it consumes no simulation state, no wall clock, no randomness, so the same duel replays the same
// finisher. v1 has no weapon-dependent row (one table for every weapon); the weapons argument pins the contract for the
// per-weapon rows a later pass may add. Presentation falls back to the plain Death clip for any finisher whose clip has
// not shipped yet (ship order: Split Crown end-to-end first, then the set).
export type FinisherId = 'splitCrown' | 'runThrough' | 'quietOne' | 'opened' | 'hamstrung' | 'execution';

const HEAVIES: readonly MoveId[] = ['heavy_overhead', 'heavy_riposte', 'heavy_counter'];
const THRUSTS: readonly MoveId[] = ['thrust', 'riposte'];   // the riposte is the punish thrust

export function selectFinisher(finish: Finish, weapons: readonly [WeaponId, WeaponId]): FinisherId | null {
  void weapons;   // v1: one table for every weapon — the parameter pins the contract for the per-weapon rows a later pass may add
  if (finish.draw) return null;                  // a double fall gets no ceremony
  if (finish.victim === 0) return null;          // the player's own death keeps the plain fall (v2 review)
  if (finish.move === 'kick') return null;       // kicked to death: no blade, no blade closer, no blood (2026-09-13)
  if (finish.move === 'critical') return 'execution';
  if (THRUSTS.includes(finish.move)) return 'runThrough';
  // Owner decision 2026-09-18 (recorded on PR #112): a heavy blow that kills = Split Crown, on ANY location the coarse
  // hit-detection reports — universal across weapons and characters (the player-wielded sword's arcs never reach the head
  // region; nobody can aim, so tying the flagship finisher to a head point guaranteed it never played). v1 ships Split
  // Crown alone; the remaining universal finishers join a deterministic rotation pool seeded from the kill event (never
  // wall-clock randomness — same duel, same finisher), and weapon/class-specific specials come later as a separate layer.
  if (HEAVIES.includes(finish.move)) return 'splitCrown';
  if (finish.location === 'legs') return 'hamstrung';
  return 'quietOne';                             // a light cut through the body reads the same underplayed way as the neck cut
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
