// The Gear tab's stat strip (src/fight/gear-stats.ts is the Attack/RES TABLE; this file is only the strip's rows) (the paper-doll reference, Dom 2026-10-11: Health / Stamina / ... under the slots). A stat is a ROW: an id, a label and a
// `read` over what the sheet knows; the strip draws the rows that have a value and nothing else (a stat nothing computes yet is not invented), so a new
// attribute (mana, intelligence) is one more row and no markup or CSS. Today the rows are this array; the follow-up feeds it from Combat's pool/attribute
// definitions table (id, label, default...): `statRows(ctx, thatTable.map(toRow))`, after which adding a stat is a data row only.
// `base` is what the host hands in (the Pit and the zone read their combat constants, so src/core imports nothing from src/fight); `worn` is the ledger's worn pieces,
// for rows that add what gear gives once pieces carry numbers (Origin season 1).
import type { LootId } from './loot.ts';

export type StatContext = { base: Readonly<Record<string, number>>; worn: readonly LootId[] };
export type GearStat = { id: string; label: string; read: (c: StatContext) => number | null };
export type StatRow = { id: string; label: string; value: string };

export const GEAR_STATS: readonly GearStat[] = [
  { id: 'health', label: 'Health', read: (c) => c.base.health ?? null },
  { id: 'stamina', label: 'Stamina', read: (c) => c.base.stamina ?? null },
  { id: 'attack', label: 'Attack', read: (c) => c.base.attack ?? null },   // gear's tilt in whole points, brief 19 Addendum C: "ATK 15 · RES 20", unsigned
  { id: 'res', label: 'Resistance', read: (c) => c.base.res ?? null },
];

export const statRows = (ctx: StatContext, stats: readonly GearStat[] = GEAR_STATS): StatRow[] =>
  stats.flatMap((stat) => { const value = stat.read(ctx); return value === null || !Number.isFinite(value) ? [] : [{ id: stat.id, label: stat.label, value: String(Math.round(value)) }]; });

/** One piece's own line for its backpack row: what it gives at its rung, as the paperdoll reads it ("ATK 15 · RES 20", unsigned magnitudes of the tilt, brief 19 Addendum C), or "No bonus" when it gives nothing (a Recruit piece is the identity rung). */
export const pieceLine = (nums: Readonly<Record<string, number>>): string => {
  const parts = [['attack', 'ATK'], ['res', 'RES']].flatMap(([id, short]) => { const n = Math.round(nums[id!] ?? 0); return n > 0 ? [`${short} ${n}`] : []; });
  return parts.length ? parts.join(' · ') : 'No bonus';
};

/** Draw the rows into the strip (a <dl>); no rows = the strip is hidden. */
export function renderStats(host: HTMLElement, rows: readonly StatRow[], doc: Pick<Document, 'createElement'>): void {   // `doc` is the page's own (the sheet's), as loot-panel.ts takes its document
  host.hidden = rows.length === 0;
  host.replaceChildren(...rows.flatMap((row) => {
    const wrap = doc.createElement('div'), dt = doc.createElement('dt'), dd = doc.createElement('dd');
    wrap.setAttribute('data-stat', row.id); dt.textContent = row.label; dd.textContent = row.value; wrap.append(dt, dd);
    return [wrap];
  }));
}

// NEW beside EQUIPPED (Dom's in-world pickup-compare reference, 2026-10-11): a try-on from the pack shows the piece and what it replaces as two compact cards, with the strip's own
// rows under each (the NEW card's number is the total AFTER the swap with the change beside it, EQUIPPED's the total now). Rows come from the same registry, so a new attribute shows here
// with no code of its own; a row only one side has is skipped. `ctx` is what the host's numbers say for that ledger (before / after the swap).
export type CompareRow = { id: string; label: string; now: string; next: string; delta: number };
export type CompareCard = { name: string; image?: string; sub?: string };
export const compareRows = (now: StatContext, next: StatContext, stats: readonly GearStat[] = GEAR_STATS): CompareRow[] =>
  stats.flatMap((stat) => { const a = stat.read(now), b = stat.read(next); return a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) ? [] : [{ id: stat.id, label: stat.label, now: String(Math.round(a)), next: String(Math.round(b)), delta: Math.round(b) - Math.round(a) }]; });

export function renderCompare(host: HTMLElement, sides: { now: CompareCard | null; next: CompareCard; rows: readonly CompareRow[] }, doc: Pick<Document, 'createElement'>): void {
  const el = (tag: string, text?: string, cls?: string) => { const e = doc.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.setAttribute('class', cls); return e; };
  const card = (side: 'new' | 'held', tag: string, c: CompareCard | null) => {
    const box = el('div'); box.setAttribute('data-side', side); box.append(el('p', tag, 'cmp-tag'));
    if (c?.image) { const img = el('img') as HTMLImageElement; img.src = c.image; img.alt = ''; img.width = img.height = 40; box.append(img); }
    box.append(el('strong', c?.name ?? 'Empty', 'cmp-name')); if (c?.sub) box.append(el('small', c.sub, 'cmp-sub'));
    const dl = el('dl', undefined, 'cmp-rows');
    for (const row of sides.rows) {
      const line = el('div'); line.setAttribute('data-stat', row.id); const dd = el('dd', side === 'new' ? row.next : row.now);
      if (side === 'new' && row.delta !== 0) { const d = el('span', `${row.delta > 0 ? '+' : '−'}${Math.abs(row.delta)}`, 'cmp-delta'); d.setAttribute('data-sign', row.delta > 0 ? 'up' : 'down'); dd.append(d); }
      line.append(el('dt', row.label), dd); dl.append(line);
    }
    box.append(dl); return box;
  };
  host.replaceChildren(card('new', 'New', sides.next), card('held', 'Equipped', sides.now));
  host.hidden = false;
}
