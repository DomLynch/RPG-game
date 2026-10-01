import { RULES } from './moves.ts';
import type { Fighter } from './duel.ts';
import { LAND_AT } from './special-timing.ts';

// The class specials' three-free timing (the Witch, the Plague Doctor, the Knight; effects in special-fx-class.ts, loaded lazily): the registry (special-modes.ts) reads the gait from here
// without pulling the effect's chunk into the main bundle.
export type ClassSpecial = 'wake' | 'stirring' | 'tempo' | 'pulse' | 'drag' | 'swing';
// The rig plays a slow gait through each of the Doctor's three steps and through the Knight's drag (special-modes.ts `travel`); the anchor does the actual moving.
export const STEP_BEATS = [56, 88, LAND_AT] as const, STEP_WINDOW = 26, DRAG_FROM = 36;
export const classTravel = (kind: ClassSpecial) => (side: 0 | 1, fighters: readonly [Fighter, Fighter]): number | undefined => {
  const left = fighters[1].special ?? 0;
  if (side !== 1 || left <= 0) return undefined;
  const age = RULES.special.windup - left;
  if (kind === 'tempo') return STEP_BEATS.some((b) => age >= b - STEP_WINDOW && age < b) ? 1.8 : undefined;
  return kind === 'drag' && age >= DRAG_FROM ? 1.4 : undefined;
};
