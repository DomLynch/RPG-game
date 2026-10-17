import type { Profile } from './profile.ts';
import CAREER_RULES from './career-rules.json' with { type: 'json' };

const LADDER = CAREER_RULES.ladderRule[0]!;   // the ladderRule row of career-rules.json (every default equals the literal it replaced; tests/career-rules.test.ts pins it)

// Career rank from victory marks — the 50-level ladder (Dom via Strategy, 2026-09-27; 2026-10-05: Origin gets its own I–V, was singular at 46):
// level = 1 + wins, capped at 50. Ten street-plain titles, sub-ranks I–V on all ten; ONE win per
// sub-rank everywhere, so Recruit V is 4 wins, Origin I 45 and Origin V 49. Wins only add marks and losses never remove them, so rank never demotes.
// Existing marks carry over as they are: the count is the same, only the mapping changed. Pure: the same count renders the same rank on
// the HUD, in the journal, in tests and on the loot verifier (deploy.sh ships src/ to it, so client and server switch together).
export const TITLES = ['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'] as const;
export const MAX_LEVEL = LADDER.maxLevel;
// A fight recorded before the 50-level ladder (record version < FIRST_FIFTY_VERSION) was fought under a top of 46: the server judges it by the rank
// that ladder gave (awards.ts levelRefusal), so a claim already in the queue at the deploy is not refused for a floor that did not exist when it was played.
export const FIRST_FIFTY_VERSION = 27, OLD_MAX_LEVEL = LADDER.oldMaxLevel;
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
// THE BETA CUT (Dom 2026-10-17; Strategy's lists): the Pit shows the first `titles` titles of the ladder and the signed-off spell list. A VIEW, not a rule: the server keeps every row, every mark and MAX_LEVEL / OLD_MAX_LEVEL
// (a stored L16 account still loads and keeps its marks, it is shown at the cut); the client reads the cut through `betaMarks` / `betaLevel` and awards.ts judges a claim against the same cut, so a win fought at the cut counts.
// Lifting the cut is the one row: `titles` of 10 (or more) lifts the level cap, an empty `spells` lifts the spell list.
const BETA = CAREER_RULES.betaCut[0]!;
export const BETA_MAX_LEVEL = Math.min(MAX_LEVEL, BETA.titles * RANK_STEPS), BETA_SPELLS: ReadonlySet<string> = new Set(BETA.spells);
export const betaLevel = (level: number): number => Math.min(level, BETA_MAX_LEVEL);
export const betaMarks = (marks: number): number => Math.min(marks, BETA_MAX_LEVEL - 1);   // level = 1 + marks (levelOfMarks)
export const inBetaSpells = (legend: string): boolean => BETA_SPELLS.size === 0 || BETA_SPELLS.has(legend);
const wins = (marks: number): number => (Number.isFinite(marks) ? Math.max(0, Math.floor(marks)) : 0);
// The career level the ladder's difficulty reads (moves.ts profileAt, Combat): 1 for a fresh fighter, 50 at Origin V.
export const levelOfMarks = (marks: number): number => Math.min(MAX_LEVEL, 1 + wins(marks));
// The difficulty dial (Dom via Strategy, 2026-09-27): the opponent fights at the dial, not the rank; the HUD shows rank only. The dial
// normally equals the rank level. Two straight losses at the same dial: dial −1 (rank unchanged, never below 1). Each win: dial +1, never
// above the rank; three straight wins: the dial snaps to the rank. It never trails the rank by more than DIAL_TRAIL. Device-only state.
export type Dial = { level: number; losses: number; wins: number };
export const DIAL_TRAIL = LADDER.dialTrail;
export const dialLevel = (dial: Pick<Dial, 'level'> | undefined, rank: number): number =>
  Math.min(rank, Math.max(1, rank - DIAL_TRAIL, Number.isInteger(dial?.level) ? dial!.level : rank));
// The level a ladder fight is fought at: the dial against the career count's rank level. main.ts builds the Match and every career rematch
// with it, from the count the rank shows (shownMarks: the server figure once there), so a rematch never skips the dial.
export const fightLevel = (dial: Pick<Dial, 'level'> | undefined, marks: number): number => dialLevel(dial, levelOfMarks(marks));
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
  const level = levelOfMarks(marks), index = level - 1;
  const title = TITLES[Math.floor(index / NUMERALS.length)], step = index % NUMERALS.length, numeral = NUMERALS[step];
  return { title, numeral, level, label: `${title} ${numeral}`, next: TITLES[Math.floor(index / NUMERALS.length) + 1] ?? '', step, fill: 0 };
}
