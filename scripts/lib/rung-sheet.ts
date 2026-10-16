// The sheet a hero wearing a full set at one tier rung fights on (rung 0 = Recruit, 9 = Origin): the build's base with the set's dial deltas on top (gear-rows.ts gearDeltas, the same call wornGear makes),
// so a balance script's rung means what the live sheet means. Rung 0 is the naked, default-build fight (no sheet). Shared by scripts/pack-battery.ts and its test.
import { gearDeltas } from '../../src/fight/gear-rows.ts';
import { sheetOf, type Sheet } from '../../src/fight/sheet-rows.ts';

export const RUNG_MAX = 9;
export const rungSheet = (rung: number, set = 'plate'): Sheet | undefined =>
  rung <= 0 ? undefined : sheetOf({ level: 0, placed: {} }, gearDeltas(set, 1, Math.min(rung, RUNG_MAX) / RUNG_MAX));
