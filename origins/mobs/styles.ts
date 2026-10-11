// Mob fight styles (Combat, 2026-10-07): the four a mob row may name by id. A style is a pointer to an EXISTING roster opponent, whose AI
// profile rows (src/fight/moves.ts) the mob fights with, plus the one world-side number Combat owns: the health share below which a beast leaves.
// No new tuning table and no sim file touched: the duel never reads this, so there is no record bump. Expansion's mob rows reference `MobStyle`.
import type { OpponentId } from '../../src/fight/server.ts';

export const MOB_STYLES = ['brute', 'skirmisher', 'caster', 'beast'] as const;
export type MobStyle = (typeof MOB_STYLES)[number];

export type MobStyleRow = {
  opponent: OpponentId;   // whose AI rows and weapon table the mob fights with
  fleeBelow?: number;     // world behaviour: at or below this share of max health the mob leaves the fight and walks off (the zone's, never a duel rule); absent = fights to the death
};

export const MOB_STYLE: Readonly<Record<MobStyle, MobStyleRow>> = {
  brute: { opponent: 'pitborn' },          // slow heavy-hitter: the cleaver, poise and stamina game
  skirmisher: { opponent: 'nightborn' },       // NOT a bowman: ranged stays out of the duel (combat-study.md), so this is the Nightborn's poke-and-withdraw at the estoc's reach
  caster: { opponent: 'witch' },           // the Witch's witchfire special and her read-and-guard brain
  beast: { opponent: 'goblin', fleeBelow: 0.3 },   // quick, hit-and-run; flees under 30% (Combat's number; the `flee-at` twist carries its own percent)
};

// The opponent a mob style fights as, or undefined for an unknown id (a mob row from content this build does not know).
export const styleOpponent = (style: string): OpponentId | undefined => (MOB_STYLES as readonly string[]).includes(style) ? MOB_STYLE[style as MobStyle].opponent : undefined;

// The style a roster body fights as (the first style that points at it), for an encounter that names a body and no style yet.
export const styleOf = (opponent: string): MobStyle | undefined => MOB_STYLES.find(s => MOB_STYLE[s].opponent === opponent);

// The switch for the style flee in fightSetup. OFF until World's wounded/catch window ships (mobs.md 5.11): with it on, a fleeing creature pays no kill, CP or loot. Turn it on in the same release as that window, writer reinstalled with the client.
export const STYLE_FLEE_LIVE = false;

// The flee-at percent a style carries (a whole percent, the twist flag's own unit), or undefined when it fights to the end.
export const fleePercent = (style: MobStyle): number | undefined => { const below = MOB_STYLE[style].fleeBelow; return below === undefined ? undefined : Math.round(below * 100); };

// True when a mob of this style, at `health` of `maxHealth`, has had enough: at or below the threshold, the same boundary as the flee-at twist (src/fight/twist.ts flees when health% <= percent).
export const fleesNow = (style: MobStyle, health: number, maxHealth: number): boolean => {
  const percent = fleePercent(style);
  return percent !== undefined && maxHealth > 0 && health > 0 && health / maxHealth * 100 <= percent;
};
