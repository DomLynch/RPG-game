import type { Profile } from './profile.ts';

// Career rank from victory marks — GAME_SPEC "Fighter progression ladder" (owner-locked 2026-09-18, revised 09-19): ten street-plain
// titles, sub-ranks I–V on the first nine, Origin singular; Recruit and Legionary fill 3 marks per sub-rank (Gladiator at 30 wins),
// Gladiator onward 5 (Origin at 205). Wins only add marks and losses never remove them, so rank never demotes. Pure: the same count
// renders the same rank on the HUD, in the journal and in tests.
export const TITLES = ['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'] as const;
export const ORIGIN_MARKS = 205;
const NUMERALS = ['I', 'II', 'III', 'IV', 'V'] as const;
// step/fill: the class-progress bar (Dom 2026-09-23) — one segment per numeral, `step` of them done, the current one `fill` (0..1) full;
// next: the class the bar climbs toward ('' at Origin, which has no bar).
export type Rank = { title: (typeof TITLES)[number]; numeral: string; filled: number; pips: number; label: string; next: string; step: number; fill: number };
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
export function rankFor(marks: number): Rank {
  let left = Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0;
  for (let tier = 0; tier < TITLES.length - 1; tier++) {
    const pips = tier < 2 ? 3 : 5;
    if (left < pips * NUMERALS.length) {
      const sub = Math.floor(left / pips), filled = left - sub * pips, title = TITLES[tier], numeral = NUMERALS[sub];
      const dots = [...Array(pips)].map((_, i) => (i < filled ? '●' : '○')).join(' ');
      return { title, numeral, filled, pips, label: `${title} ${numeral} · ${dots}`, next: TITLES[tier + 1], step: sub, fill: filled / pips };
    }
    left -= pips * NUMERALS.length;
  }
  return { title: 'Origin', numeral: '', filled: 0, pips: 0, label: 'Origin', next: '', step: 0, fill: 0 };
}
