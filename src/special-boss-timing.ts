// The boss specials' own presentation timing (Multi Chars; special-fx-boss.ts draws them). Pure and three-free like
// special-timing.ts beside it: ticks at the sim's 60 Hz from the SpecialStarted tick, the strike landing at LAND_AT (the one 120 of RULES.special.windup).
import type { OpponentId } from './roster.ts';
import { LAND_AT } from './special-timing.ts';

export type BossKind = 'mist' | 'echo' | 'price' | 'flies' | 'stain' | 'breath';   // the ?special= ids special-fx-boss.ts draws
export const BUILD = 30;   // the visible build-up: the last half second before the landing (Dom: a 1-2 s build-up was too slow on Red Wind)
export const BUILD_AT = LAND_AT - BUILD;
// Which cast each boss effect is for: the lane's own class skill, on the opponent's side (advanceCast's `is`; special-timing.ts is not edited for it).
const CLASS_SKILL: Partial<Record<OpponentId, string>> = { witch: 'skill_witchfire', plaguedoctor: 'skill_miasma' };
export const isBossCast = (opponent: OpponentId, actor: number, move?: string) => actor === 1 && move !== undefined && CLASS_SKILL[opponent] === move;
