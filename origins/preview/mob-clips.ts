// Which clip a Zone 1 creature plays for a combat event. The roster bodies already carry them: the quadruped rig (wolf, boar, bear: scripts/character/quadruped_rig.py) has
// Bite / Hurt / Death, the humanoid world bodies (goblin, knight, pitborn, witch) Attack / Hit / Death. src/characters.ts maps the same roles for the duel (QUADRUPED_CLIPS);
// this is the three the open world needs, picked by what the body actually has, so a body with none of them keeps World's procedural lunge / pulse / fall.
export type MobRole = 'attack' | 'hit' | 'death';
const PREFER: Readonly<Record<MobRole, readonly string[]>> = { attack: ['Bite', 'Attack'], hit: ['Hurt', 'Hit'], death: ['Death'] };

/** The first preferred clip name the body has for `role`, or null. */
export const mobClipName = (role: MobRole, clipNames: readonly string[]): string | null => PREFER[role].find((n) => clipNames.includes(n)) ?? null;
