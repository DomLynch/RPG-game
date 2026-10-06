import { OPPONENTS, type Opponent, type OpponentId } from './moves.ts';
import { ARENA_ROTATION, type ArenaKey } from './arena-themes.ts';
import type { Finish } from './duel.ts';

import { ENCOUNTERS, isHeld, isOpponentId } from './roster.ts';
// Introductory encounter order: the roster's encounters minus the held ones. Career rank is independent of this selection.
export const LADDER = ENCOUNTERS.filter(o => !o.hold);
// A URL override (harness, dev look) beats saved progress; anything unknown — or a held encounter saved before the hold — falls back to the first rung.
export const opponentFor = (ladder: string | undefined, override?: string): Opponent => { const id = override || ladder; return isOpponentId(id) && !isHeld(id) ? OPPONENTS[id] : OPPONENTS.veteran; };
export const won = (finish: Finish | null): boolean => !!finish && finish.victim === 1 && !finish.draw;
// The ladder's order (Dom via Strategy, 2026-09-27): fight 1 is always the Centurion (opponentFor's fallback); after a win the next is a
// random pick from the opponents NOT yet beaten in the current pass. A loss is a rematch with the same one (no next), so he stays in
// the pool until beaten. When all ten are beaten the pass ends and a new one begins with all ten back (the one just beaten excepted, so
// no instant repeat; the Centurion is not forced). `beaten` is the pass so far (profile.pass); `key` makes the pick a pure function of
// the profile, so the HUD's "Next:" label and the Next button always name the same man. Returns the pass to store with the pick.
export function nextOpponent(current: OpponentId, beaten: readonly string[], key: number): { id: OpponentId; name: string; pass: OpponentId[] } {
  const done = LADDER.filter(o => o.id === current || beaten.includes(o.id)).map(o => o.id);   // unknown or held ids drop out here
  const left = LADDER.filter(o => !done.includes(o.id));
  const pool = left.length ? left : LADDER.filter(o => o.id !== current);
  const { id, name } = pool[(key >>> 0) % pool.length];
  return { id, name, pass: left.length ? done : [] };
}
// The arena of the NEXT fight (Lead 2026-10-06): a shuffle-bag over ARENA_ROTATION, the same shape as nextOpponent. `seen` is the cycle so far (profile.arenaPass);
// the arena just fought is always in it, so no arena comes twice in a row, and when the bag is empty a new cycle starts with everything but the one just fought.
// Pure in (current, seen, key), so a refresh draws the same arena. A rematch never calls this: the arena changes only with the opponent.
export function nextArena(current: ArenaKey, seen: readonly string[], key: number): { arena: ArenaKey; pass: ArenaKey[] } {
  const done = ARENA_ROTATION.filter(a => a === current || seen.includes(a));   // unknown ids drop out here
  const left = ARENA_ROTATION.filter(a => !done.includes(a));
  const pool = left.length ? left : ARENA_ROTATION.filter(a => a !== current);
  return { arena: pool[(key >>> 0) % pool.length], pass: left.length ? done : [current] };
}
// The pick's key: FNV-1a over the profile id and its win count, so each win draws afresh and a refresh draws the same.
export const passKey = (profileId: string, marks: number): number => {
  let h = 0x811c9dc5;
  for (const c of `${profileId}:${marks}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return h >>> 0;
};
