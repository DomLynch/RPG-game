// The Sparring dummy (Dom via Strategy, 2026-09-26): an opponent that never attacks and guards on a low share, for Web's Sparring mode.
// Deliberately OUTSIDE the sim files (tests/record-version-guard.test.ts SIM_FILES): decide() and the rules are untouched, so no
// RECORD_VERSION bump and no fixture change. The dummy is the ordinary warden with its attacks taken out of the intent AFTER decide(),
// so a record cannot replay it; Sparring writes nothing and mints no link. tests/sparring.test.ts pins the profile and the 0-attack row.
import { decide } from './ai.ts';
import { project, type Practice } from './combat.ts';
import { stepDuel, type Action, type Intent } from './duel.ts';
import { PROFILES, type AiProfile } from './moves.ts';

// easy's reaction and read; no parry, no roll, no aggression; guard .25 = the guard game a quarter of the time (0 would never block).
export const SPARRING_DUMMY: AiProfile = { ...PROFILES.easy, parry: 0, dodge: 0, aggression: 0, guard: .25 };

const ATTACKS: ReadonlySet<Action> = new Set<Action>(['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill']);
export const disarm = (intent: Intent): Intent => (intent.action && ATTACKS.has(intent.action) ? { ...intent, action: null, held: false } : intent);

export function stepSparring(current: Practice, intent: Intent, profile: AiProfile = SPARRING_DUMMY): Practice {
  const dummy = decide(current.duel, 1, current.ai, profile);
  return project(stepDuel(current.duel, [intent, disarm(dummy.intent)]), dummy.ai, current);
}
