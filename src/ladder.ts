import { OPPONENTS, type Opponent, type OpponentId } from './moves.ts';
import type { Finish } from './duel.ts';

// Introductory encounter order. Career rank is independent of this selection.
export { ENCOUNTERS as LADDER } from './roster.ts';
import { ENCOUNTERS, isOpponentId } from './roster.ts';
// A URL override (harness, dev look) beats saved progress; anything unknown falls back to the first rung.
export const opponentFor = (ladder: string | undefined, override?: string): Opponent => { const id = override || ladder; return isOpponentId(id) ? OPPONENTS[id] : OPPONENTS.veteran; };
export const won = (finish: Finish | null): boolean => !!finish && finish.victim === 1 && !finish.draw;
export const nextAfter = (id: OpponentId): { id: OpponentId; name: string } | undefined => ENCOUNTERS[ENCOUNTERS.findIndex(o => o.id === id) + 1];
