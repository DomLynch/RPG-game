// Origins side of the combat-luck ruling (docs/specs/origins/combat-study.md, RULING 2026-10-07: Dom, agreed by Strategy). Pure: no DOM,
// clock, storage or Math.random. The world-mob damage roll is Origins' own end to end (Lead, 2026-10-07): this module and its seeded
// source. The Gambit is Combat's (src/: the move, the self-stagger, the unknowable PvP roll); here are only its odds, caps and HUD text,
// so the two sides share one set of numbers. Every number here is PROVISIONAL until the battery sets it.

// Where a fight happens. Dom's ruling (2026-10-07): damage rolls apply ONLY to Origins world mobs outside the Pit, in both directions
// (player -> mob and mob -> player). The Pit (legends and arena AI), PvP and the ladder never roll.
import { GAMBIT_ODDS, GAMBIT_KILL_FLOOR, gambitMean, resolveGambit, type GambitOdds, type GambitResult } from '../../src/gambit.ts';
import { ROLL_BAND, percentOf, rolledDamage, rollUnit } from '../../src/roll.ts';   // the one definition of the roll (also applied by the duel's Duel.roll)

export type FightKind = 'world-mob' | 'pit' | 'pvp' | 'ladder';

// The flag, default OFF. `monsterRolls` = the world-mob damage rolls. Read from the Origins config object; anything that is not exactly `true` is off.
export type LuckFlags = { monsterRolls: boolean; gambit: boolean };
export const LUCK_OFF: LuckFlags = Object.freeze({ monsterRolls: false, gambit: false });
export function parseLuckFlags(raw: unknown): LuckFlags {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { monsterRolls: o.monsterRolls === true, gambit: o.gambit === true };
}

// A unit draw in [0, 1) that is a pure function of the fight's seed and the hit's index, so the replay/hash re-sim
// reproduces it exactly (condition C5). The PvP Gambit's draw is Combat's and also folds in what neither side knows at press time (C3).
export type RollSource = (seed: number, hit: number) => number;

// ±10% damage rolls, shown on screen. `percent` is the whole-number roll the HUD shows (−10..+10); `damage` is never below 1.
export const ROLL_BAND_PERCENT = ROLL_BAND;
export type DamageRoll = { base: number; percent: number; damage: number };
export function rollDamage(base: number, u: number, band = ROLL_BAND_PERCENT): DamageRoll {
  if (!(u >= 0 && u < 1)) throw new RangeError(`roll: u must be in [0, 1), got ${u}`);
  const percent = percentOf(u, band);   // a uniform whole percent in −band..+band (src/roll.ts, the one definition the duel also applies)
  return { base, percent, damage: rolledDamage(base, percent) };
}
// The scope rule: a roll is applied only in an Origins world-mob fight with the flag on, whichever side strikes. Pit, PvP, ladder: never.
export const rollsApply = (kind: FightKind, flags: LuckFlags): boolean => kind === 'world-mob' && flags.monsterRolls;
// One hit as the fight resolves it, either direction (the caller numbers every hit of the fight in order): rolled only where the rule allows.
export function hitDamage(kind: FightKind, flags: LuckFlags, base: number, seed: number, hit: number, source: RollSource): DamageRoll {
  return rollsApply(kind, flags) ? rollDamage(base, source(seed, hit)) : { base, percent: 0, damage: base };
}

// The Gambit: a chosen version of the heavy (a second heavy press after the chamber), everywhere including PvP, with the flag on.
// Odds are ONE constant: about 1 in 2 for about 2x (Dom-approved 2026-10-07); EV slightly under a heavy once the self-stagger is counted.
export { GAMBIT_ODDS, GAMBIT_KILL_FLOOR, gambitMean, resolveGambit, type GambitOdds, type GambitResult };   // src/gambit.ts: the one definition the duel also applies
export const gambitApply = (flags: LuckFlags): boolean => flags.gambit;
// HUD text, behind the same flag (the view only places it). A shown roll reads "+7%", "−3%" or "±0%"; the odds read "1 in 2".
export const rollLabel = (r: DamageRoll): string => (r.percent > 0 ? `+${r.percent}%` : r.percent < 0 ? `−${-r.percent}%` : '±0%');
export const oddsLabel = (odds: GambitOdds = GAMBIT_ODDS): string => `1 in ${Math.round(1 / odds.chance)}`;
export type LuckHud = { roll: string | null; gambit: string | null };
export function luckHud(kind: FightKind, flags: LuckFlags, last: DamageRoll | null, odds: GambitOdds = GAMBIT_ODDS): LuckHud {
  return { roll: rollsApply(kind, flags) && last ? rollLabel(last) : null, gambit: gambitApply(flags) ? `Gambit ${oddsLabel(odds)}` : null };
}

// The world-mob roll's source: a hash of (fight seed, hit index), never Math.random, so the same fight replays the same rolls.
export const seededSource: RollSource = rollUnit;   // src/roll.ts: the same draw the duel's Duel.roll uses
