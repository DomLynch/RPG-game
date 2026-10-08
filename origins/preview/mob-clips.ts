// Which clip a Zone 1 creature plays for a combat event: copied from the Pit, not rewritten. The roster bodies already carry them, and src/characters.ts is the Pit's role map:
// a quadruped (isQuadruped: it has a Bite clip) goes through QUADRUPED_CLIPS (Attack -> Bite, Hit -> Hurt, Death -> Death), a humanoid plays the role's own name (Attack / Hit / Death).
// A body that lacks the clip returns null and keeps World's procedural lunge / pulse / fall.
import { QUADRUPED_CLIPS, isQuadruped } from '../../src/characters.ts';
import { ATTACKS } from '../../src/combat.ts';

export type MobRole = 'attack' | 'hit' | 'death';
const PIT_ROLE = { attack: 'Attack', hit: 'Hit', death: 'Death' } as const;

/** The clip `role` plays on a body with these clips, or null when it has none. */
export const mobClipName = (role: MobRole, clips: readonly { name: string }[]): string | null => {
  const name = isQuadruped({ animations: clips }) ? QUADRUPED_CLIPS[PIT_ROLE[role]] : PIT_ROLE[role];
  return name && clips.some((c) => c.name === name) ? name : null;
};

/** Where in its length each attack clip makes contact: the humanoid Attack is the Pit's authored `ATTACKS.light.source` (.34); the beasts' Bite is measured on the shipped rig (the head's forward peak, 0.43 s of 0.93 s on wolf, boar and bear). */
export const BITE_CONTACT = 0.46;
const contactOf = (clipName: string): number => (clipName === 'Bite' ? BITE_CONTACT : ATTACKS.light.source);

/** A Hit during the creature's own windup does not stop its Bite: the sim's bite still lands (the Pit's poise / hyper-armour), so the Hurt clip would cut an attack that happens. A Staggered event
 *  (the sim really cancelled the blow) passes `interrupt` and plays Hurt over it. */
export const holdsAttack = (shot: MobRole | undefined, running: boolean, role: MobRole, interrupt = false): boolean => role === 'hit' && !interrupt && shot === 'attack' && running;

/** The clip speed that lands its contact frame on the sim's strike. The creature's windup runs 0.4 s for the plain blow, 0.5 / 0.7 / 0.9 s for the wolf's lunge, the boar's charge and the bear's heavy
 *  (origins/combat/zone1.ts), and the strike comes when it ends: at speed 1 the Bite would land .07 / .27 / .47 s early. Slower for the heavy blows reads as a heavier wind-up; clamped to 0.45-2x so no clip crawls or snaps (the Pit's own 14-tick bite tell, .23 s, needs about 1.9x). Read from the event at runtime, so it stays synced when Combat changes the windups. */
export const attackTimeScale = (clipName: string, durationS: number, windupMs: number): number => Math.min(2, Math.max(0.45, (contactOf(clipName) * durationS) / (windupMs / 1000)));
