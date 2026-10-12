// Mob fight styles (Combat, 2026-10-07): the four a mob row may name by id. A style is a pointer to an EXISTING roster opponent, whose AI
// profile rows (src/fight/moves.ts) the mob fights with,.
// No new tuning table and no sim file touched: the duel never reads this, so there is no record bump. Expansion's mob rows reference `MobStyle`.
import type { OpponentId } from '../../fight/server.ts';

export const MOB_STYLES = ['brute', 'skirmisher', 'caster', 'beast'] as const;
export type MobStyle = (typeof MOB_STYLES)[number];

export type MobStyleRow = {
  opponent: OpponentId;   // whose AI rows and weapon table the mob fights with
};

export const MOB_STYLE: Readonly<Record<MobStyle, MobStyleRow>> = {
  brute: { opponent: 'pitborn' },          // slow heavy-hitter: the cleaver, poise and stamina game
  skirmisher: { opponent: 'nightborn' },       // NOT a bowman: ranged stays out of the duel (combat-study.md), so this is the Nightborn's poke-and-withdraw at the estoc's reach
  caster: { opponent: 'witch' },           // the Witch's witchfire special and her read-and-guard brain
  beast: { opponent: 'goblin' },   // quick, hit-and-run; fights to the death like every creature (creature fleeing cut by Dom 2026-10-11)
};

// The opponent a mob style fights as, or undefined for an unknown id (a mob row from content this build does not know).
export const styleOpponent = (style: string): OpponentId | undefined => (MOB_STYLES as readonly string[]).includes(style) ? MOB_STYLE[style as MobStyle].opponent : undefined;

// The style a roster body fights as (the first style that points at it), for an encounter that names a body and no style yet.
export const styleOf = (opponent: string): MobStyle | undefined => MOB_STYLES.find(s => MOB_STYLE[s].opponent === opponent);
