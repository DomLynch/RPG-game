// Pure: the skills-by-use pool (programme row 11, "points raise the ceiling, practice fills it"). A VERIFIED win practises the skill the fight was fought with.
// Grey targets pay 0 (the career model's falloff); the ceiling is XP_PER_POINT per placed point; focus doubling and the cap clamp are applied by origins_encounter_settle (migration 0026).
import { falloffPermille, isGrey } from '../../src/core/server.ts';
import { WEAPON_PRACTICE_SKILL } from '../../src/fight/server.ts';
import type { Json } from './store.ts';

export const PRACTICE_UNIT = 10;     // xp a win at the player's own level pays
export const XP_PER_POINT = 100;     // each placed point raises the ceiling by this much

export type PracticeFight = { token: string; weapon: string; enemyLevel: number; youLevel: number; placed: Readonly<Record<string, number>> };

// The lines for origins_encounter_settle's p_practice; [] when nothing is earned (unknown weapon, grey target, no point placed in the skill).
export function practiceLines(f: PracticeFight): Json[] {
  const skill = WEAPON_PRACTICE_SKILL[f.weapon];
  if (skill === undefined) return [];
  const d = f.enemyLevel - f.youLevel;
  if (isGrey(d)) return [];
  const amount = Math.floor((PRACTICE_UNIT * falloffPermille(d)) / 1000), capXp = XP_PER_POINT * Math.max(0, Math.floor(f.placed[skill] ?? 0));
  if (amount <= 0 || capXp <= 0) return [];
  return [{ skill, amount, capXp, key: `practice:enc:${f.token}:${skill}` }];
}

// A skill's current value: its base plus the points practice has filled, never past the points placed (the ceiling). xp is what the pool banks; XP_PER_POINT of it fills one point.
export const skillValue = (base: number, placed: number, xp: number): number => base + Math.min(Math.max(0, Math.floor(placed)), Math.floor(Math.max(0, xp) / XP_PER_POINT));
