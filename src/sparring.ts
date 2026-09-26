// Sparring (Dom 2026-09-26, "rapid test the game rather than trying to defeat opponents"): an admin's test fight against any
// warden, at any level, with any weapon and move, for that fight only. The journal's Options tab builds the link; the page boots on
// it the way `?daily=1` does (main.ts), and src/match.ts's 'sparring' mode writes nothing: no record, share, post, mark or loot.
// Everything in the link is public input, so each value is checked against what this build knows; one bad value refuses the link.
import type { Difficulty } from './match.ts';
import { decide } from './ai.ts';
import { project, type Practice } from './combat.ts';
import { stepDuel, type Action, type Intent } from './duel.ts';
import { PLAYER_WEAPONS, PROFILES, SKILL_MOVE, type AiProfile, type SkillId, type WeaponId } from './moves.ts';

// One flag opens Sparring to every player later; until then it shows with the admin test tools (account.ts showTools, or ?debug).
export const SPARRING_FOR_ALL = false;
export const SPARRING_LEVELS = Object.keys(PROFILES) as Difficulty[];   // easy / normal / hard ("dummy" joins when Combat ships it)
export const SPARRING_SKILLS = Object.keys(SKILL_MOVE) as SkillId[];
export type SparringKit = { weapon: WeaponId; difficulty: Difficulty; skill: SkillId | null };

// `?spar=1&weapon=…&difficulty=…&skill=…` (skill=none for no move). The opponent rides the usual `?opponent=`. Null = not a sparring link.
export function sparringParam(search: string, carried: readonly WeaponId[] = PLAYER_WEAPONS): SparringKit | null {
  const params = new URLSearchParams(search);
  if (params.get('spar') !== '1') return null;
  const weapon = params.get('weapon') as WeaponId, difficulty = params.get('difficulty') as Difficulty, skill = params.get('skill');
  if (!carried.includes(weapon) || !SPARRING_LEVELS.includes(difficulty)) return null;
  if (skill !== 'none' && !SPARRING_SKILLS.includes(skill as SkillId)) return null;
  return { weapon, difficulty, skill: skill === 'none' ? null : (skill as SkillId) };
}
export const sparringLink = (opponent: string, kit: SparringKit): string =>
  `/?${new URLSearchParams({ opponent, spar: '1', weapon: kit.weapon, difficulty: kit.difficulty, skill: kit.skill ?? 'none' })}`;

// The Sparring dummy (Dom via Strategy, 2026-09-26): an opponent that never attacks and guards on a low share, for Web's Sparring mode.
// Deliberately OUTSIDE the sim files (tests/record-version-guard.test.ts SIM_FILES): decide() and the rules are untouched, so no
// RECORD_VERSION bump and no fixture change. The dummy is the ordinary warden with its attacks taken out of the intent AFTER decide(),
// so a record cannot replay it; Sparring writes nothing and mints no link. tests/sparring.test.ts pins the profile and the 0-attack row.
// easy's reaction and read; no parry, no roll, no aggression; guard .25 = the guard game a quarter of the time (0 would never block).
export const SPARRING_DUMMY: AiProfile = { ...PROFILES.easy, parry: 0, dodge: 0, aggression: 0, guard: .25 };

const ATTACKS: ReadonlySet<Action> = new Set<Action>(['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill']);
export const disarm = (intent: Intent): Intent => (intent.action && ATTACKS.has(intent.action) ? { ...intent, action: null, held: false } : intent);

export function stepSparring(current: Practice, intent: Intent, profile: AiProfile = SPARRING_DUMMY): Practice {
  const dummy = decide(current.duel, 1, current.ai, profile);
  return project(stepDuel(current.duel, [intent, disarm(dummy.intent)]), dummy.ai, current);
}
