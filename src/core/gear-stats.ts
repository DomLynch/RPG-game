// The Gear tab's stat strip (the paper-doll reference, Dom 2026-10-11: Health / Stamina / ... under the slots). A stat is a ROW: an id, a label and a
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
];

export const statRows = (ctx: StatContext, stats: readonly GearStat[] = GEAR_STATS): StatRow[] =>
  stats.flatMap((stat) => { const value = stat.read(ctx); return value === null || !Number.isFinite(value) ? [] : [{ id: stat.id, label: stat.label, value: String(Math.round(value)) }]; });

/** Draw the rows into the strip (a <dl>); no rows = the strip is hidden. */
export function renderStats(host: HTMLElement, rows: readonly StatRow[], doc: Pick<Document, 'createElement'>): void {   // `doc` is the page's own (the sheet's), as loot-panel.ts takes its document
  host.hidden = rows.length === 0;
  host.replaceChildren(...rows.flatMap((row) => {
    const wrap = doc.createElement('div'), dt = doc.createElement('dt'), dd = doc.createElement('dd');
    wrap.setAttribute('data-stat', row.id); dt.textContent = row.label; dd.textContent = row.value; wrap.append(dt, dd);
    return [wrap];
  }));
}
