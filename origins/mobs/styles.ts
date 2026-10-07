// Mob fight styles (Combat, 2026-10-07): the four a mob row may name by id. A style is a pointer to an EXISTING roster opponent, whose AI
// profile rows (src/moves.ts) the mob fights with, plus the one world-side number Combat owns: the health share below which a beast leaves.
// No new tuning table and no sim file touched: the duel never reads this, so there is no record bump. Expansion's mob rows reference `MobStyle`.
import type { OpponentId } from '../../src/roster.ts';

export const MOB_STYLES = ['brute', 'archer', 'caster', 'beast'] as const;
export type MobStyle = (typeof MOB_STYLES)[number];

export type MobStyleRow = {
  opponent: OpponentId;   // whose AI rows and weapon table the mob fights with
  fleeBelow?: number;     // world behaviour: below this share of max health the mob leaves the fight and walks off (the zone's, never a duel rule); absent = fights to the death
};

export const MOB_STYLE: Readonly<Record<MobStyle, MobStyleRow>> = {
  brute: { opponent: 'pitborn' },          // slow heavy-hitter: the cleaver, poise and stamina game
  archer: { opponent: 'nightborn' },       // no ranged opponent exists (combat-study.md: ranged roles are out): the nearest is poke-and-withdraw at the estoc's reach
  caster: { opponent: 'witch' },           // the Witch's witchfire special and her read-and-guard brain
  beast: { opponent: 'goblin', fleeBelow: 0.3 },   // quick, hit-and-run; flees under 30%, the same share as the `flee-at` twist's default percent
};

// The opponent a mob style fights as, or undefined for an unknown id (a mob row from content this build does not know).
export const styleOpponent = (style: string): OpponentId | undefined => (MOB_STYLES as readonly string[]).includes(style) ? MOB_STYLE[style as MobStyle].opponent : undefined;

// True when a mob of this style, at `health` of `maxHealth`, has had enough. Strictly below the threshold, so a mob at exactly 30% still fights.
export const fleesNow = (style: MobStyle, health: number, maxHealth: number): boolean => {
  const below = MOB_STYLE[style].fleeBelow;
  return below !== undefined && maxHealth > 0 && health > 0 && health / maxHealth < below;
};
