import type { Profile } from './profile.ts';

// Career rank from victory marks — the 50-level ladder (Dom via Strategy, 2026-09-27; 2026-10-05: Origin gets its own I–V, was singular at 46):
// level = 1 + wins, capped at 50. Ten street-plain titles, sub-ranks I–V on all ten; ONE win per
// sub-rank everywhere, so Recruit V is 4 wins, Origin I 45 and Origin V 49. Wins only add marks and losses never remove them, so rank never demotes.
// Existing marks carry over as they are: the count is the same, only the mapping changed. Pure: the same count renders the same rank on
// the HUD, in the journal, in tests and on the loot verifier (deploy.sh ships src/ to it, so client and server switch together).
export const TITLES = ['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'] as const;
export const MAX_LEVEL = 50;
// A fight recorded before the 50-level ladder (record version < FIRST_FIFTY_VERSION) was fought under a top of 46: the server judges it by the rank
// that ladder gave (awards.ts levelRefusal), so a claim already in the queue at the deploy is not refused for a floor that did not exist when it was played.
export const FIRST_FIFTY_VERSION = 27, OLD_MAX_LEVEL = 46;
const NUMERALS = ['I', 'II', 'III', 'IV', 'V'] as const;
// step/fill: the class-progress bar (Dom 2026-09-23; 2026-09-27: one whole segment per win, no partial fill) — one segment per numeral,
// `step` of them lit, `fill` always 0 now (kept so the bar code reads unchanged); next: the class the bar climbs toward ('' at Origin, no bar).
export type Rank = { title: (typeof TITLES)[number]; numeral: string; level: number; label: string; next: string; step: number; fill: number };
export const marksOf = (profile: Pick<Profile, 'career'>): number => profile.career?.victoryMarks ?? 0;
// The marks the rank shows: the account's server figure when it has one (session.standing) plus its unswept claims and the wins still
// in this device's claims outbox (loot-claims.ts), else this device's count.
export const shownMarks = (server: number | null, profile: Pick<Profile, 'career'>, pending = 0): number => (server === null ? marksOf(profile) : server + pending);
// Beta award policy (owner 2026-09-20): every won duel in the arena earns one mark — a rematch or a journal-picked opponent included.
export function awardMark(profile: Profile): number {
  const victoryMarks = marksOf(profile) + 1;
  profile.career = { victoryMarks };
  return victoryMarks;
}
export const RANK_STEPS = NUMERALS.length;
const wins = (marks: number): number => (Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0);
// The career level the ladder's difficulty reads (moves.ts profileAt, Combat): 1 for a fresh fighter, 50 at Origin V.
export const levelOf = (marks: number): number => Math.min(MAX_LEVEL, 1 + wins(marks));
// The difficulty dial (Dom via Strategy, 2026-09-27): the opponent fights at the dial, not the rank; the HUD shows rank only. The dial
// normally equals the rank level. Two straight losses at the same dial: dial −1 (rank unchanged, never below 1). Each win: dial +1, never
// above the rank; three straight wins: the dial snaps to the rank. It never trails the rank by more than DIAL_TRAIL. Device-only state.
export type Dial = { level: number; losses: number; wins: number };
export const DIAL_TRAIL = 5;
export const dialLevel = (dial: Pick<Dial, 'level'> | undefined, rank: number): number =>
  Math.min(rank, Math.max(1, rank - DIAL_TRAIL, Number.isInteger(dial?.level) ? dial!.level : rank));
// The level a ladder fight is fought at: the dial against the career count's rank level. main.ts builds the Match and every career rematch
// with it, from the count the rank shows (shownMarks: the server figure once there), so a rematch never skips the dial.
export const fightLevel = (dial: Pick<Dial, 'level'> | undefined, marks: number): number => dialLevel(dial, levelOf(marks));
// `rank`: the rank level the fight was fought at (before its result lands).
export function turnDial(dial: Dial | undefined, rank: number, won: boolean): Dial {
  const level = dialLevel(dial, rank);
  if (won) {
    const next = Math.min(MAX_LEVEL, rank + 1), wins = (dial?.wins ?? 0) + 1;
    return { level: wins >= 3 ? next : Math.min(next, level + 1), losses: 0, wins };
  }
  const losses = (dial?.losses ?? 0) + 1;
  return losses >= 2 ? { level: Math.max(1, rank - DIAL_TRAIL, level - 1), losses: 0, wins: 0 } : { level, losses, wins: 0 };
}
export function rankFor(marks: number): Rank {
  const level = levelOf(marks), index = level - 1;
  const title = TITLES[Math.floor(index / NUMERALS.length)], step = index % NUMERALS.length, numeral = NUMERALS[step];
  return { title, numeral, level, label: `${title} ${numeral}`, next: TITLES[Math.floor(index / NUMERALS.length) + 1] ?? '', step, fill: 0 };
}
