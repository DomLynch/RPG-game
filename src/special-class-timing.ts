import { RULES } from './moves.ts';
import type { Fighter } from './duel.ts';
import { LAND_AT } from './special-timing.ts';

// The class specials' three-free timing (the Witch, the Plague Doctor, the Knight; effects in special-fx-class.ts, loaded lazily): the registry (special-modes.ts) reads the gait from here
// without pulling the effect's chunk into the main bundle.
export type ClassSpecial = 'wake' | 'stirring' | 'tempo' | 'pulse' | 'drag' | 'swing';
// The rig plays a slow gait through each of the Doctor's three steps and through the Knight's drag (special-modes.ts `travel`); the anchor does the actual moving.
const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };
// The camera sits behind the player, so what the walkers leave behind them is hidden under the two bodies unless it lies in the open ground BEHIND the caster (first clips, 2026-10-02):
// both walkers first back off BACK metres (the rig walks backwards, BACK_AT..BACK_AT + BACK_TICKS), then walk in from there, so the trench and the prints are laid in the clear.
export const BACK = 0.9, BACK_TICKS = 26, BACK_PACE = -2, BACK_AT = { tempo: 4, drag: 6 } as const;
export const STEP_BEATS = [56, 88, LAND_AT] as const, STEP_WINDOW = 26, DRAG_FROM = 36;
export const classTravel = (kind: ClassSpecial) => (side: 0 | 1, fighters: readonly [Fighter, Fighter]): number | undefined => {
  const left = fighters[1].special ?? 0;
  if (side !== 1 || left <= 0) return undefined;
  const age = RULES.special.windup - left;
  if ((kind === 'tempo' || kind === 'drag') && age >= BACK_AT[kind] && age < BACK_AT[kind] + BACK_TICKS) return BACK_PACE;
  if (kind === 'tempo') return STEP_BEATS.some((b) => age >= b - STEP_WINDOW && age < b) ? 1.8 : undefined;
  return kind === 'drag' && age >= DRAG_FROM ? 1.4 : undefined;
};
// Where the walker stands along the line to the foe, metres off his sim spot, `age` ticks into the cast (negative while he is backed off); `dist` is the gap to the foe.
export const walkOffset = (kind: 'tempo' | 'drag', age: number, dist: number): number => {
  const reach = Math.max(0, dist - (kind === 'tempo' ? 1.1 : 1.0)), back = smooth((age - BACK_AT[kind]) / BACK_TICKS);
  const fwd = kind === 'tempo' ? STEP_BEATS.reduce((sum, beat) => sum + smooth((age - (beat - STEP_WINDOW)) / STEP_WINDOW), 0) / 3 : smooth((age - DRAG_FROM) / (LAND_AT - DRAG_FROM));
  return -BACK * back + (reach + BACK) * fwd;
};
