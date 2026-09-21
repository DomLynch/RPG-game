import { readFileSync } from 'node:fs';
import { ROSTER, isOpponentId } from '../src/roster.ts';
import { WEAPONS, weaponOf } from '../src/moves.ts';

// Resolve before loading any source art; the runtime and offline builder share the catalogue.
export function warriorRecipe(fighter = 'hero', override) {
  if (fighter !== 'hero' && !isOpponentId(fighter)) throw new Error(`Unknown fighter: ${fighter}`);
  const recipe = fighter === 'hero' ? null : ROSTER[fighter];
  const approved = weaponOf(recipe?.weapon ?? 'longsword');
  const weapon = override || (approved.placeholder ? 'longsword' : approved.id);
  if (!Object.hasOwn(WEAPONS, weapon)) throw new Error(`Unknown weapon: ${weapon}`);
  return { body: recipe?.body ?? 'realistic', weapon, ...(['minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf'].includes(fighter) ? { pipeline: 'reconstruction' } : {}) };
}

// The dwarf donor's re-proportioning (build-warrior.mjs BUILD.dwarf.bones): per-bone [x, y, z] scale about the bone's own joint in its rest
// frame, applied through skin weights. One JSON so scripts/character/loot_dwarf.py (Blender) and the loot build invert the same field.
export const DWARF_BONES = JSON.parse(readFileSync(new URL('./character/dwarf-bones.json', import.meta.url), 'utf8'));
