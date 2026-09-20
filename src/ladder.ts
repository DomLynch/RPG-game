import { OPPONENTS, type Opponent, type OpponentId } from './moves.ts';
import type { Finish } from './duel.ts';

import { ENCOUNTERS, isHeld, isOpponentId } from './roster.ts';
// Introductory encounter order: the roster's encounters minus the held ones. Career rank is independent of this selection.
export const LADDER = ENCOUNTERS.filter(o => !o.hold);
// A URL override (harness, dev look) beats saved progress; anything unknown — or a held encounter saved before the hold — falls back to the first rung.
export const opponentFor = (ladder: string | undefined, override?: string): Opponent => { const id = override || ladder; return isOpponentId(id) && !isHeld(id) ? OPPONENTS[id] : OPPONENTS.veteran; };
export const won = (finish: Finish | null): boolean => !!finish && finish.victim === 1 && !finish.draw;
export const nextAfter = (id: OpponentId): { id: OpponentId; name: string } | undefined => { const i = LADDER.findIndex(o => o.id === id); return i < 0 ? undefined : LADDER[i + 1]; };   // a held id is not a rung: no next
