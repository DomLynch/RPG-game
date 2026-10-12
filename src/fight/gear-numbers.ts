// The numbers the Gear tab's strip shows (src/core/gear-strip.ts draws whatever rows have a value): the combat constants a fighter starts with, and the gear's
// tilt in whole points from the Attack/RES table (gear-stats.ts, brief 19). A piece with no recorded rung counts as no gear (kitFrom: identity, never a guess).
// Lives here, not in src/core, because the core imports nothing from src/fight; the Pit and the zone both hand it to the sheet.
import { TIERS } from '../core/grades.ts';
import type { Loot } from '../core/loot.ts';
import { gearSheet, kitFrom, loadoutFor, wholePoints } from './gear-stats.ts';
import type { Sheet } from './sheet-rows.ts';
import { RULES } from './moves.ts';
import { STAMINA_MAX } from './world.ts';

// What the player wears as a Loadout: each worn piece counts at the rung it was won at (`loot.taken[id].tier`); a piece with no recorded rung counts as nothing. One lookup for the strip's numbers and the fight's sheet.
const loadoutOfLoot = (loot: Loot | undefined) => loadoutFor(kitFrom(loot?.equipped ?? {}, (id) => { const level = loot?.taken?.[id]?.tier; return level ? TIERS[level - 1] : undefined; }));
export const gearNumbers = (loot: Loot | undefined): Record<string, number> => {
  const { atk, res } = wholePoints(loadoutOfLoot(loot));
  return { health: RULES.health, stamina: STAMINA_MAX, attack: atk, res };
};
// The sheet a live fight is fought with (Wave A1 PR1b): the gear layer of what is worn now, `undefined` when nothing counts (the naked fight, byte for byte). Level, skill and title layers join here when their lanes land.
export const sheetOfLoot = (loot: Loot | undefined): Sheet | undefined => gearSheet(loadoutOfLoot(loot));
