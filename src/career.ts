import type { Profile } from './profile.ts';

// Career rank from victory marks — the 46-level ladder (Dom via Strategy, 2026-09-27; was 3-then-5 marks per sub-rank, Origin at 205):
// level = 1 + wins, capped at 46. Ten street-plain titles, sub-ranks I–V on the first nine, Origin singular at level 46; ONE win per
// sub-rank everywhere, so Recruit V is 4 wins and Origin 45. Wins only add marks and losses never remove them, so rank never demotes.
// Existing marks carry over as they are: the count is the same, only the mapping changed. Pure: the same count renders the same rank on
// the HUD, in the journal, in tests and on the loot verifier (deploy.sh ships src/ to it, so client and server switch together).
export const TITLES = ['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'] as const;
export const MAX_LEVEL = 46;
const NUMERALS = ['I', 'II', 'III', 'IV', 'V'] as const;
// step/fill: the class-progress bar (Dom 2026-09-23; 2026-09-27: one whole segment per win, no partial fill) — one segment per numeral,
// `step` of them lit, `fill` always 0 now (kept so the bar code reads unchanged); next: the class the bar climbs toward ('' at Origin, no bar).
export type Rank = { title: (typeof TITLES)[number]; numeral: string; level: number; label: string; next: string; step: number; fill: number };
export const marksOf = (profile: Pick<Profile, 'career'>): number => profile.career?.victoryMarks ?? 0;
// The marks the rank shows: the account's server figure when it has one (session.marks), else this device's count.
export const shownMarks = (server: number | null, profile: Pick<Profile, 'career'>): number => server ?? marksOf(profile);
// Beta award policy (owner 2026-09-20): every won duel in the arena earns one mark — a rematch or a journal-picked opponent included.
export function awardMark(profile: Profile): number {
  const victoryMarks = marksOf(profile) + 1;
  profile.career = { victoryMarks };
  return victoryMarks;
}
export const RANK_STEPS = NUMERALS.length;
const wins = (marks: number): number => (Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0);
// The career level the ladder's difficulty reads (moves.ts profileAt, Combat): 1 for a fresh fighter, 46 at Origin.
export const levelOf = (marks: number): number => Math.min(MAX_LEVEL, 1 + wins(marks));
export function rankFor(marks: number): Rank {
  const level = levelOf(marks), index = level - 1;
  if (level === MAX_LEVEL) return { title: 'Origin', numeral: '', level, label: 'Origin', next: '', step: 0, fill: 0 };
  const title = TITLES[Math.floor(index / NUMERALS.length)], step = index % NUMERALS.length, numeral = NUMERALS[step];
  return { title, numeral, level, label: `${title} ${numeral}`, next: TITLES[Math.floor(index / NUMERALS.length) + 1], step, fill: 0 };
}
