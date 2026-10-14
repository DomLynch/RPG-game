// The spend rules a player sees (Web, programme 2a, Dom's lock): one point per level, placed on reaching it on ANY dial or skill row; taking points back is free up to level 10 and then once a rank
// (the server's rule, origins/server/build.ts: the client only mirrors it to show the button). Rows, caps and the budget are Combat A's (sheet-rows.ts validateBuild), asked here, never answered twice.
// Pure: no DOM, no network.
import { DIALS, SHEET_SKILLS, pointsAt, validateBuild } from '../fight/sheet-rows.ts';
import type { BuildView } from './build-net.ts';
import ROW_NAMES from './row-names.json' with { type: 'json' };

export type Row = { id: string; name: string; kind: 'dial' | 'skill'; room: number };   // room: the most points the row can hold (cap - base)
// Display names are rows (row-names.json, presentation only: the sim's sheet-defs.json stays untouched, so no record version moves); a row with no name shows its id, which tests/build-model.test.ts forbids.
const NAME = new Map((ROW_NAMES.rows as readonly { id: string; name: string }[]).map((r) => [r.id, r.name]));
const nameOf = (id: string): string => NAME.get(id) ?? id;
export const ROWS: readonly Row[] = [...DIALS.map((d) => ({ id: d.id, name: nameOf(d.id), kind: 'dial' as const, room: d.cap - d.base })), ...SHEET_SKILLS.map((s) => ({ id: s.id, name: nameOf(s.id), kind: 'skill' as const, room: s.cap - s.base }))];

export const FREE_RESPREAD_LEVEL = 10, RANK_LEVELS = 10;   // the server's numbers (origins/server/build.ts)
export const pointsBudget = (level: number): number => pointsAt(level);   // the stats screen's "of N": asked of the rows, never answered twice
export const spent = (v: BuildView): number => Object.values(v.placed).reduce((n, x) => n + x, 0);
export const unspent = (v: BuildView): number => Math.max(0, pointsAt(v.level) - spent(v));
export const placedOn = (v: BuildView, id: string): number => v.placed[id] ?? 0;
const withPlaced = (v: BuildView, id: string, n: number): BuildView => { const placed = { ...v.placed }; if (n > 0) placed[id] = n; else delete placed[id]; return { ...v, placed }; };

export const canPlace = (v: BuildView, id: string): boolean => {
  const row = ROWS.find((r) => r.id === id);
  return !!row && unspent(v) > 0 && placedOn(v, id) < row.room && validateBuild({ level: v.level, placed: withPlaced(v, id, placedOn(v, id) + 1).placed }).length === 0;
};
export const place = (v: BuildView, id: string): BuildView => (canPlace(v, id) ? withPlaced(v, id, placedOn(v, id) + 1) : v);
// Taking points back: free to level 10, then once per rank-up (rank = level / 10; respreadRank is the last one used).
export const canTakeBack = (v: BuildView): boolean => v.level <= FREE_RESPREAD_LEVEL || v.respreadRank < Math.floor(v.level / RANK_LEVELS);
export const takeBack = (v: BuildView, id: string): BuildView => (placedOn(v, id) > 0 && canTakeBack(v) ? withPlaced(v, id, placedOn(v, id) - 1) : v);
export const resetAll = (v: BuildView): BuildView => (canTakeBack(v) ? { ...v, placed: {} } : v);
// The level this build's last "place your point" prompt was shown for lives in the page (sessionStorage), not here.
export const needsPoint = (v: BuildView): boolean => unspent(v) > 0;
