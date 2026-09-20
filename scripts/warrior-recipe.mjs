import { ROSTER, isOpponentId } from '../src/roster.ts';
import { WEAPONS, weaponOf } from '../src/moves.ts';

// Resolve before loading any source art; the runtime and offline builder share the catalogue.
export function warriorRecipe(fighter = 'hero', override) {
  if (fighter !== 'hero' && !isOpponentId(fighter)) throw new Error(`Unknown fighter: ${fighter}`);
  const recipe = fighter === 'hero' ? null : ROSTER[fighter];
  const approved = weaponOf(recipe?.weapon ?? 'longsword');
  const weapon = override || (approved.placeholder ? 'longsword' : approved.id);
  if (!Object.hasOwn(WEAPONS, weapon)) throw new Error(`Unknown weapon: ${weapon}`);
  return { body: recipe?.body ?? 'realistic', weapon, ...(['minotaur', 'wraith', 'werewolf', 'skeleton'].includes(fighter) ? { pipeline: 'reconstruction' } : {}) };
}
