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
  return { body: recipe?.body ?? 'realistic', weapon, ...(['minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf', 'plaguedoctor', 'knight', 'witch'].includes(fighter) ? { pipeline: 'reconstruction' } : {}) };
}

// The dwarf donor's re-proportioning (build-warrior.mjs BUILD.dwarf.bones): per-bone [x, y, z] scale about the bone's own joint in its rest
// frame, applied through skin weights. One JSON so scripts/character/loot_dwarf.py (Blender) and the loot build invert the same field.
export const DWARF_BONES = JSON.parse(readFileSync(new URL('./character/dwarf-bones.json', import.meta.url), 'utf8'));
// The goblin's re-proportioning, beside the dwarf's because BOTH are needed by two callers: build-warrior.mjs builds
// his body from it, and the loot unscaler inverts it to cut a piece for him. It lived inline in build-warrior.mjs's
// `BUILD` table, which is narrowed to one fighter per run — so the unscaler could not reach it and `unscale: "goblin"`
// threw. Scales are per bone about its own joint in its rest frame: y is length along the bone, x/z girth.
export const GOBLIN_BONES = { thigh_l: [1, .84, 1], thigh_r: [1, .84, 1], calf_l: [1, .84, 1], calf_r: [1, .84, 1],   // short legs
  upperarm_l: [1, 1.16, 1], upperarm_r: [1, 1.16, 1], lowerarm_l: [1, 1.16, 1], lowerarm_r: [1, 1.16, 1],   // long arms (the hands keep their size: the grip and the sword are untouched)
  neck_01: [.86, .9, .86], Head: [1.17, 1.17, 1.17] };   // a thin, shorter neck; a big head
// Every re-proportioned fighter, keyed by the name `loot.json`'s `unscale` uses. One list, so a fighter cannot be
// re-proportioned for his body and unknown to the unscaler at the same time (tests/loot-unscale-tables.test.ts).
export const PROPORTION_TABLES = { dwarf: DWARF_BONES, goblin: GOBLIN_BONES };
