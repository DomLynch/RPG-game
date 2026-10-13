// Release speed (Deploy, 2026-10-13): release-checks ran one GitHub job per row. EH: 38 jobs, each repeating ~110-125 s of identical setup (45% of all runner time),
// queued 708 s on average behind the account's ~40 slots. Rows are packed into a few balanced jobs instead: setup is paid once per job, a candidate holds ~10 slots.
// Receipts stay per row (ci-row-group.mjs writes one per row); only the job that runs them is shared.
import { readFileSync } from 'node:fs';

/** Measured seconds of each CI row's own step (max of the EH and EK candidate runs, 2026-10-13); a row not listed is packed as DEFAULT_ROW_S. */
export const rowSeconds = () => JSON.parse(readFileSync(new URL('./row-seconds.json', import.meta.url), 'utf8'));
export const DEFAULT_ROW_S = 120;
export const TARGET_GROUP_S = 480;

/** rows: [{ index, name, argv }]. Longest-processing-time first into n balanced bins (n = ceil(total / target)); a single row longer than the target gets a bin alone.
 *  Deterministic: ties by row index. Returns [{ id, rows, estimateS }] with ids g1.. in descending estimate, rows inside a group in ascending index. */
export function packRows(rows, seconds = rowSeconds(), target = TARGET_GROUP_S) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const w = r => Number(seconds[r.index]) || DEFAULT_ROW_S;
  const total = rows.reduce((sum, r) => sum + w(r), 0);
  const bins = Array.from({ length: Math.max(1, Math.ceil(total / target)) }, () => ({ rows: [], load: 0 }));
  for (const r of [...rows].sort((a, b) => w(b) - w(a) || a.index - b.index)) {
    const bin = bins.reduce((best, b) => (b.load < best.load ? b : best), bins[0]);
    bin.rows.push(r); bin.load += w(r);
  }
  return bins.filter(b => b.rows.length).sort((a, b) => b.load - a.load || a.rows[0].index - b.rows[0].index)
    .map((b, i) => ({ id: `g${i + 1}`, rows: b.rows.sort((x, y) => x.index - y.index), estimateS: b.load }));
}

/** The job title: `checks 11,14,24 (polearm-browser-check+account-browser-check)`. ci-trusted-checks.mjs reads the row list from the leading `checks <csv> `. */
export const groupLabel = g => {
  const names = [...new Set(g.rows.map(r => r.name))];
  const shown = names.slice(0, 2).join('+') + (names.length > 2 ? `+${names.length - 2} more` : '');
  return `${g.rows.map(r => r.index).join(',')} (${shown})`;
};
