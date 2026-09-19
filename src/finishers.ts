import type { Finish } from './duel.ts';
import type { WeaponId } from './moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17, GAME_SPEC "Owner-authorized finishers & gore"). The simulation decided
// the kill already: selection is a pure function of the Killed event's data (victim, location, move, heading) and the
// fighters' weapons — it consumes no simulation state, no wall clock, no randomness, so the same duel replays the same
// finisher. v1 has no weapon-dependent row (one table for every weapon); the weapons argument pins the contract for the
// per-weapon rows a later pass may add. Presentation falls back to the plain Death clip for any finisher whose clip has
// not shipped yet (ship order: Split Crown end-to-end first, then the set).
export type FinisherId = 'splitCrown' | 'decapitation' | 'runThrough' | 'plainDeath' | 'quietOne' | 'opened' | 'hamstrung' | 'execution';

export function selectFinisher(finish: Finish, weapons: readonly [WeaponId, WeaponId]): FinisherId | null {
  void weapons;   // v1: one table for every weapon — the parameter pins the contract for the per-weapon rows a later pass may add
  if (finish.draw) return null;                  // a double fall gets no ceremony
  if (finish.victim === 0) return null;          // the player's own death keeps the plain fall (v2 review)
  if (finish.move === 'kick') return null;       // kicked to death: no blade, no blade closer, no blood (2026-09-13)
  // Owner rule 2026-09-18 (recorded on PR #112, broadened same day after the owner's live playtest): ANY blade kill plays
  // the finisher — light cut, thrust, riposte, heavy, critical, whatever the sim reports — universal across weapons and
  // characters. Nobody aims in this game, so gating the showpiece behind a blow type the player can't feel guaranteed it
  // never played.
  // Owner 2026-09-18 (after judging v1 on the phone): kills rotate through the SHIPPED SET + the plain death — Split Crown,
  // Decapitation, Run Through, The Quiet One, Opened, or no ceremony at all — picked by a deterministic rotation pool seeded from the kill event
  // (never wall-clock randomness — same duel, same finisher); the pool grows as the remaining finishers land. The plain
  // death staying in the mix is the owner's call: a kill landing on the default fall keeps it frighteningly ordinary.
  const seed = `${finish.victim}|${finish.location}|${finish.move}|${finish.heading}|${weapons[0]}|${weapons[1]}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const pick = Math.abs(hash % 6);
  return pick === 0 ? 'splitCrown' : pick === 1 ? 'decapitation' : pick === 2 ? 'runThrough' : pick === 3 ? 'plainDeath' : pick === 4 ? 'quietOne' : 'opened';
}

// Which rigs carry which finisher clip today. null = the plain Death plays until the clip lands (the plain death is also a
// first-class rotation outcome, 'plainDeath'). The pose word is what characters.ts `update` understands. Decapitation reuses
// the Split Crown body collapse (the same straight-down drop); Run Through has its own clip — impaled on the blade, held
// beat gripping it, then kneels with it still embedded. Quiet One clutches the throat and collapses onto its side.
// Opened uses the existing upright jolt, followed by a separately posed waist bake; off keeps the intact collapse.
// Victim clips are 2.4 s, authored per rig and played at 0.75x on the presentation clock.
export const FINISHER_POSE: Record<FinisherId, 'splitCrown' | 'decapitation' | 'runThrough' | 'quietOne' | 'opened' | null> = {
  splitCrown: 'splitCrown',
  decapitation: 'decapitation',
  runThrough: 'runThrough',
  plainDeath: null,
  quietOne: 'quietOne',
  opened: 'opened',
  hamstrung: null,
  execution: null,
};
