import { OPPONENTS, type Opponent, type OpponentId } from './moves.ts';
import type { Finish } from './duel.ts';

// The ladder: who stands opposite once the fighter opposite is beaten, in the roster's teaching order (GAME_SPEC).
// Progress is the device profile's `ladder`; a loss keeps the current opponent, a win offers the next one.
export const LADDER: { id: OpponentId; name: string }[] = [{ id: 'veteran', name: 'the Veteran' }, { id: 'pitborn', name: 'the Pitborn' }, { id: 'goblin', name: 'the Goblin' }, { id: 'nightborn', name: 'the Nightborn' }, { id: 'executioner', name: 'the Executioner' }];   // reach → pressure → speed → restraint → the giant (owner, 2026-09-18: after the Nightborn; he fights the Veteran's brain until the combat lead writes his profile)
// A URL override (harness, dev look) beats saved progress; anything unknown falls back to the first rung.
export const opponentFor = (ladder: string | undefined, override?: string): Opponent => { const id = override || ladder; return id && Object.hasOwn(OPPONENTS, id) ? OPPONENTS[id as OpponentId] : OPPONENTS.veteran; };
export const won = (finish: Finish | null): boolean => !!finish && finish.victim === 1 && !finish.draw;
export const nextAfter = (id: OpponentId): { id: OpponentId; name: string } | undefined => LADDER[LADDER.findIndex(o => o.id === id) + 1];
