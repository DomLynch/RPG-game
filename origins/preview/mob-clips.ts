// Which clip a Zone 1 creature plays for a combat event: copied from the Pit, not rewritten. The roster bodies already carry them, and src/characters.ts is the Pit's role map:
// a quadruped (isQuadruped: it has a Bite clip) goes through QUADRUPED_CLIPS (Attack -> Bite, Hit -> Hurt, Death -> Death), a humanoid plays the role's own name (Attack / Hit / Death).
// A body that lacks the clip returns null and keeps World's procedural lunge / pulse / fall.
import { QUADRUPED_CLIPS, isQuadruped } from '../../src/characters.ts';

export type MobRole = 'attack' | 'hit' | 'death';
const PIT_ROLE = { attack: 'Attack', hit: 'Hit', death: 'Death' } as const;

/** The clip `role` plays on a body with these clips, or null when it has none. */
export const mobClipName = (role: MobRole, clips: readonly { name: string }[]): string | null => {
  const name = isQuadruped({ animations: clips }) ? QUADRUPED_CLIPS[PIT_ROLE[role]] : PIT_ROLE[role];
  return name && clips.some((c) => c.name === name) ? name : null;
};
