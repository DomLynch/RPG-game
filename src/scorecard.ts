import type { StoragePort } from './profile.ts';
import { isOpponentId, type OpponentId } from './roster.ts';

// Beta scorecard (owner 2026-09-20): fights, wins and losses per opponent, saved on this device. "Left" counts inside losses — a
// fight the player walked out of (AFK catch-up or a closed page) is a loss, flagged so the owner can see how many were walk-aways.
// Draws (a double fall) count as a fight and nothing else. Device-local for the beta; a later pass can sync it like career marks.
type Line = { fights: number; wins: number; losses: number; left: number; last: string[] };   // last: the autopsy of the last fight against him (src/autopsy.ts), at most two lines, empty after a win
export type Scorecard = { version: 1; rows: Partial<Record<OpponentId, Line>> };
type Outcome = 'win' | 'loss' | 'draw';
const KEY = 'frankendom.scorecard.v1';
const count = (n: unknown): number => (Number.isSafeInteger(n) && (n as number) >= 0 ? (n as number) : 0);
const emptyLine = (): Line => ({ fights: 0, wins: 0, losses: 0, left: 0, last: [] });
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length <= 200).slice(0, 2) : []);

export function loadScorecard(storage: StoragePort): Scorecard {
  const card: Scorecard = { version: 1, rows: {} };
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null');
    if (value?.version === 1 && value.rows && typeof value.rows === 'object')
      for (const [id, line] of Object.entries(value.rows as Record<string, Partial<Line>>))
        if (isOpponentId(id) && line) card.rows[id] = { fights: count(line.fights), wins: count(line.wins), losses: count(line.losses), left: count(line.left), last: lines(line.last) };
  } catch { /* unreadable storage: a fresh card, never a blocked arena */ }
  return card;
}
export function saveScorecard(storage: StoragePort, card: Scorecard): boolean {
  try { storage.setItem(KEY, JSON.stringify(card)); return true; } catch { return false; }
}
export function recordResult(card: Scorecard, opponent: OpponentId, outcome: Outcome, left = false, last: string[] = []): Line {
  const line = card.rows[opponent] ?? (card.rows[opponent] = emptyLine());
  line.fights++;
  if (outcome === 'win') line.wins++;
  if (outcome === 'loss') { line.losses++; if (left) line.left++; }
  line.last = last.slice(0, 2);
  return line;
}
export function totals(card: Scorecard): Line {
  const sum = emptyLine();
  for (const line of Object.values(card.rows)) { sum.fights += line.fights; sum.wins += line.wins; sum.losses += line.losses; sum.left += line.left; }
  return sum;
}
// Rows for the journal table: every listed opponent (even at 0), then the total. Losses read "3 (1 left)" only when a walk-away happened.
export function scorecardRows(card: Scorecard, opponents: readonly { id: OpponentId; name: string }[]): { name: string; fights: number; wins: number; losses: string; last: string[] }[] {
  const losses = (line: Line) => (line.left ? `${line.losses} (${line.left} left)` : String(line.losses));
  const rows = opponents.map(({ id, name }) => { const line = card.rows[id] ?? emptyLine(); return { name, fights: line.fights, wins: line.wins, losses: losses(line), last: line.last }; });
  rows.sort((a, b) => b.fights - a.fights);   // most-fought first (Dom 2026-09-23); a stable sort keeps ladder order on ties
  const all = totals(card);
  return [...rows, { name: 'All fights', fights: all.fights, wins: all.wins, losses: losses(all), last: [] }];
}
