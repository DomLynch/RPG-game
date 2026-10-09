// Which of the Pit hero's clips a Zone 1 swing plays. The role is the Pit's own choice (characters.ts, the combatRole line: heavy -> Heavy, kick -> Kick, thrust -> Thrust, left cut -> Return, else Attack)
// and the name is the sword's row of WEAPON_CLIPS through clipFor (Thrust -> Riposte): no table of ours, no new art; warrior.glb carries every one of these clips.
import { clipFor, type Role } from '../../src/characters.ts';

export const swingRole = (move: string): Role =>
  move.startsWith('heavy') ? 'Heavy' : move === 'kick' ? 'Kick' : move === 'thrust' ? 'Thrust' : move === 'riposte' || move === 'slash_riposte' ? 'Riposte' : move === 'light_left' ? 'Return' : 'Attack';
export const swingClip = (move: string): string => clipFor('longsword', swingRole(move));
/** The clips the page loads for the hero's swings (the sword's, once each). */
export const SWING_CLIPS: readonly string[] = [...new Set(['light_right', 'light_left', 'heavy_overhead', 'thrust', 'kick', 'riposte'].map(swingClip))];
