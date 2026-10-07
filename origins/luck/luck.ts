// Origins side of the combat-luck ruling (docs/specs/origins/combat-study.md, RULING 2026-10-07: Dom, agreed by Strategy). Pure: no DOM,
// clock, storage or Math.random. The world-mob damage roll is Origins' own end to end (Lead, 2026-10-07): this module and its seeded
// source. The Gambit is Combat's (src/: the move, the self-stagger, the unknowable PvP roll); here are only its odds, caps and HUD text,
// so the two sides share one set of numbers. Every number here is PROVISIONAL until the battery sets it.

// Where a fight happens. Dom's ruling (2026-10-07): damage rolls apply ONLY to Origins world mobs outside the Pit, in both directions
// (player -> mob and mob -> player). The Pit (legends and arena AI), PvP and the ladder never roll.
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
export const ROLL_BAND_PERCENT = 10;
export type DamageRoll = { base: number; percent: number; damage: number };
export function rollDamage(base: number, u: number, band = ROLL_BAND_PERCENT): DamageRoll {
  if (!(u >= 0 && u < 1)) throw new RangeError(`roll: u must be in [0, 1), got ${u}`);
  const percent = Math.min(band, Math.floor(u * (2 * band + 1)) - band);   // a uniform whole percent in −band..+band
  return { base, percent, damage: Math.max(1, Math.round(base * (1 + percent / 100))) };
}
// The scope rule: a roll is applied only in an Origins world-mob fight with the flag on, whichever side strikes. Pit, PvP, ladder: never.
export const rollsApply = (kind: FightKind, flags: LuckFlags): boolean => kind === 'world-mob' && flags.monsterRolls;
// One hit as the fight resolves it, either direction (the caller numbers every hit of the fight in order): rolled only where the rule allows.
export function hitDamage(kind: FightKind, flags: LuckFlags, base: number, seed: number, hit: number, source: RollSource): DamageRoll {
  return rollsApply(kind, flags) ? rollDamage(base, source(seed, hit)) : { base, percent: 0, damage: base };
}

// The Gambit: a chosen version of the heavy (a second heavy press after the chamber), everywhere including PvP, with the flag on.
// Odds are ONE constant: about 1 in 2 for about 2x (Dom-approved 2026-10-07); EV slightly under a heavy once the self-stagger is counted.
export type GambitOdds = { chance: number; multiplier: number };
export const GAMBIT_ODDS: GambitOdds = Object.freeze({ chance: 1 / 2, multiplier: 2 });
export const GAMBIT_KILL_FLOOR = 0.4;   // C1: a landed Gambit never kills from above 40% of max health
export const gambitApply = (flags: LuckFlags): boolean => flags.gambit;
// C1: the mean landed damage must not beat the plain heavy (the self-stagger's punish cost then makes it slightly worse, as ruled).
export const gambitMean = (heavy: number, odds: GambitOdds = GAMBIT_ODDS): number => heavy * odds.chance * odds.multiplier;
export type GambitResult = { landed: boolean; damage: number };   // not landed = the thrower staggers (Combat's state), no damage
export function resolveGambit(heavy: number, u: number, health: number, maxHealth: number, odds: GambitOdds = GAMBIT_ODDS): GambitResult {
  if (!(u >= 0 && u < 1)) throw new RangeError(`gambit: u must be in [0, 1), got ${u}`);
  if (u >= odds.chance) return { landed: false, damage: 0 };
  const raw = Math.round(heavy * odds.multiplier);
  return { landed: true, damage: health > maxHealth * GAMBIT_KILL_FLOOR ? Math.min(raw, health - 1) : raw };
}

// HUD text, behind the same flag (the view only places it). A shown roll reads "+7%", "−3%" or "±0%"; the odds read "1 in 2".
export const rollLabel = (r: DamageRoll): string => (r.percent > 0 ? `+${r.percent}%` : r.percent < 0 ? `−${-r.percent}%` : '±0%');
export const oddsLabel = (odds: GambitOdds = GAMBIT_ODDS): string => `1 in ${Math.round(1 / odds.chance)}`;
export type LuckHud = { roll: string | null; gambit: string | null };
export function luckHud(kind: FightKind, flags: LuckFlags, last: DamageRoll | null, odds: GambitOdds = GAMBIT_ODDS): LuckHud {
  return { roll: rollsApply(kind, flags) && last ? rollLabel(last) : null, gambit: gambitApply(flags) ? `Gambit ${oddsLabel(odds)}` : null };
}

// The world-mob roll's source: a hash of (fight seed, hit index), never Math.random, so the same fight replays the same rolls.
export const seededSource: RollSource = (seed, hit) => {
  let h = Math.imul((seed >>> 0) ^ Math.imul(hit + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
};
