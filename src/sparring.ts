// Sparring (Dom 2026-09-26, "rapid test the game rather than trying to defeat opponents"): an admin's test fight against any
// warden, at any level, with any weapon and move, for that fight only. The journal's Options tab builds the link; the page boots on
// it the way a kill link does (main.ts), and src/match.ts's 'sparring' mode writes nothing: no record, share, post, mark or loot.
// Everything in the link is public input, so each value is checked against what this build knows; one bad value refuses the link.
import type { Difficulty } from './match.ts';
import { decide } from './ai.ts';
import { project, type Practice } from './combat.ts';
import { stepDuel, type Action, type Intent } from './duel.ts';
import { LEVELS, PLAYER_WEAPONS, PROFILES, SKILL_MOVE, type AiProfile, type SkillId, type WeaponId } from './moves.ts';
import type { SpecialTest } from './special-look.ts';

// One flag opens Sparring to every player later; until then it shows with the admin test tools (account.ts showTools, or ?debug).
export const SPARRING_FOR_ALL = false;
// easy / normal / hard, plus the no-attack dummy (below), which stays OUT of PROFILES: the sim's levels are untouched. A number is a ladder
// level 1..LEVELS (Dom 2026-09-29: the admin Sparring tab's Difficulty is the level, dressed at its rung like #1070); the presets stay readable
// for links made before.
export type SparringLevel = Difficulty | 'dummy' | number;
export const SPARRING_LEVELS: SparringLevel[] = [...(Object.keys(PROFILES) as Difficulty[]), 'dummy'];
const sparringLevel = (raw: string | null): SparringLevel | null => {
  if (raw !== null && /^\d{1,2}$/.test(raw)) { const level = Number(raw); return level >= 1 && level <= LEVELS ? level : null; }
  return SPARRING_LEVELS.includes(raw as SparringLevel) ? (raw as SparringLevel) : null;
};
export const SPARRING_SKILLS = Object.keys(SKILL_MOVE) as SkillId[];
export type SparringKit = { weapon: WeaponId; difficulty: SparringLevel; skill: SkillId | null };

// `?spar=1&weapon=…&difficulty=…&skill=…` (skill=none for no move). The opponent rides the usual `?opponent=`. Null = not a sparring link.
export function sparringParam(search: string, carried: readonly WeaponId[] = PLAYER_WEAPONS): SparringKit | null {
  const params = new URLSearchParams(search);
  if (params.get('spar') !== '1') return null;
  const weapon = params.get('weapon') as WeaponId, difficulty = sparringLevel(params.get('difficulty')), skill = params.get('skill');
  if (!carried.includes(weapon) || difficulty === null) return null;
  if (skill !== 'none' && !SPARRING_SKILLS.includes(skill as SkillId)) return null;
  return { weapon, difficulty, skill: skill === 'none' ? null : (skill as SkillId) };
}
// The link asked for sparring (`?spar=1`), readable or not: main.ts banners one sparringParam refuses (an unknown weapon, level or skill).
export const sparringAsked = (search: string): boolean => new URLSearchParams(search).get('spar') === '1';
export const sparringLink = (opponent: string, kit: SparringKit, special?: SpecialTest | null, yourSpecial?: SpecialTest | null): string =>
  `/?${new URLSearchParams({ opponent, spar: '1', weapon: kit.weapon, difficulty: String(kit.difficulty), skill: kit.skill ?? 'none', ...(special === undefined ? {} : { special: special ?? 'none' }), ...(yourSpecial === undefined ? {} : { yourSpecial: yourSpecial ?? 'none' }) })}`;

// The Options tab's Dev kit (Dom on his phone, 2026-09-27): the weapon, move and level an admin's LADDER fights use, picked in the Dev
// section and kept for the tab like the Arena pick (main.ts). Unset = the equipped kit and the career's level. The rig loads one weapon
// per page, so a weapon or move pick reloads; the level also applies live. Stored text is input: one bad field is dropped, not the kit.
export const DEV_KIT_KEY = 'frankendom.dev-kit';
export type DevKit = { weapon?: WeaponId; skill?: SkillId; level?: number };
export function devKit(stored: string | null, carried: readonly WeaponId[] = PLAYER_WEAPONS): DevKit {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(stored ?? '{}') ?? {}; } catch { return {}; }
  const kit: DevKit = {};
  if (carried.includes(raw.weapon as WeaponId)) kit.weapon = raw.weapon as WeaponId;
  if (SPARRING_SKILLS.includes(raw.skill as SkillId)) kit.skill = raw.skill as SkillId;
  if (Number.isInteger(raw.level) && (raw.level as number) >= 1 && (raw.level as number) <= LEVELS) kit.level = raw.level as number;
  return kit;
}

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
