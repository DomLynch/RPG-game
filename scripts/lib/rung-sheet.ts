// The sheet a hero of `level` wearing a full set at one tier rung fights on (rung 0 = Recruit/no gear, 9 = Origin): the build's points for that level spread evenly over attack, armour, health and poise, with the
// set's dial deltas on top (gear-rows.ts gearDeltas, the same call wornGear makes), so a balance script's level and rung mean what the live sheet means. Level 0 and rung 0 is the naked default-build fight
// (no sheet). Shared by scripts/pack-battery.ts and its test.
import { gearDeltas } from '../../src/fight/gear-rows.ts';
import { DIALS, pointsAt, sheetOf, type Sheet } from '../../src/fight/sheet-rows.ts';

export const RUNG_MAX = 9;
const SPREAD = ['attack', 'armour', 'health', 'poise'];
export const rungSheet = (rung: number, level = 0, set = 'plate', recruit = false): Sheet | undefined => {   // recruit: rung 0 wears the full set at the Recruit tier (quality 0) instead of nothing
  const each = Math.floor(pointsAt(level) / SPREAD.length), placed: Record<string, number> = {};
  for (const id of SPREAD) { const d = DIALS.find((x) => x.id === id)!; placed[id] = Math.max(0, Math.min(each, d.cap - d.base)); }
  return sheetOf({ level, placed: each > 0 ? placed : {} }, rung <= 0 && !recruit ? {} : gearDeltas(set, 1, Math.min(rung, RUNG_MAX) / RUNG_MAX));
};
