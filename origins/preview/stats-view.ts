// What the stats screen shows, as data (Dom's critical four, item 3: full stats in the open world, Web): the player's level, the points placed against the level's budget, and a line per dial and per skill row. Pure: no DOM,
// clock, storage or network. Names and rows come from the sheet's own rows (SHEET_ROWS, row-names.json), the budget from the rules (pointsBudget); the words are stats-text.json. Nothing here computes a stat.
// Two sources, kept apart so the screen can never disagree with the server: the STORED BUILD (level, points placed on each row; the writer holds it exactly) always shows; the EFFECTIVE value of a dial (build plus worn gear)
// shows only when the caller hands in the writer's `sheet` (Backend's HeroLimit sheet, `sheetOf(stored build, worn gear)`). Until then the dial lines carry the placed points and no effective number, never a guessed one.
import TEXT from './stats-text.json' with { type: 'json' };
import { pointsBudget, pointsSpent, SHEET_ROWS } from '../../src/core/index.ts';

export type StatsSource = { level: number; placed: Readonly<Record<string, number>>; sheet?: Readonly<Record<string, number>> };
export type StatLine = { id: string; name: string; kind: 'dial' | 'skill'; placedText: string; value: string; fraction: number | null };
export type StatsView = { levelText: string; pointsText: string; dials: StatLine[]; skills: StatLine[]; hasSheet: boolean };
const { chrome: CHROME } = TEXT;
const fill = (template: string, values: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
export const chromeText = (key: keyof typeof CHROME, values: Record<string, string | number> = {}): string => fill(CHROME[key], values);

export function statsView(src: StatsSource): StatsView {
  const sheet = src.sheet;
  const line = (r: (typeof SHEET_ROWS)[number]): StatLine => {
    const n = src.placed[r.id] ?? 0, shown = r.kind === 'dial' && sheet ? (sheet[r.id] ?? null) : null;   // a dial at its base is absent from a sheet: no number, not a zero
    return { id: r.id, name: r.name, kind: r.kind, placedText: n > 0 ? chromeText('placed', { n }) : chromeText('none'), value: shown === null ? '' : chromeText('effective', { value: shown }), fraction: shown === null ? null : Math.min(1, Math.max(0, shown / 100)) };
  };
  const lines = SHEET_ROWS.map(line);
  return { levelText: chromeText('level', { level: src.level }), pointsText: chromeText('points', { spent: pointsSpent({ level: src.level, placed: { ...src.placed }, respreadRank: 0, version: 0 }), budget: pointsBudget(src.level) }),
    dials: lines.filter((l) => l.kind === 'dial'), skills: lines.filter((l) => l.kind === 'skill'), hasSheet: !!sheet };
}
