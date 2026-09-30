// The rank-look gate's verdict (scripts/rank-look-check.mjs), pure so it is tested (tests/rank-look-rows.test.ts).
// On a full-tier file of a set with phone LODs (desktop only; the phone streams the -phone file) the phone's bounds are a REPORT, printed,
// not failed: rows 5a/5c (Strategy 2026-09-30 10:1x), row 2 stream-in and row 4 swap frame (Strategy/Lead 2026-09-30 12:3x, graphics over
// perf: the full files ship as delivered). Rows 2 and 4 keep a HARD ceiling there (over it the asset re-packs, the test does not move):
// stream-in 10 s, swap frame 150 ms. A -phone file and a set without LODs keep every bound as written (row 2 4 s, row 4 50 ms).
export const FULL_TIER_HARD = { '2 ': 10, '4 ': 150 };
const reportRow = (name) => /^(5[ac]|2|4) /.test(name);

/** @param {Record<string, { value: number, limit: number, min?: boolean }>} rows @param {boolean} fullTierOnly */
export function rowVerdict(rows, fullTierOnly) {
  let pass = true; const lines = [];
  for (const [name, r] of Object.entries(rows)) {
    const within = (limit) => Number.isFinite(r.value) && (r.min ? r.value >= limit : r.value <= limit);
    const report = fullTierOnly && reportRow(name), hard = report ? FULL_TIER_HARD[name.slice(0, 2)] : undefined;
    const ok = within(r.limit), hardOk = hard === undefined || within(hard);
    r.report = report; if (hard !== undefined) r.hard = hard;
    const measured = Number.isFinite(r.value);   // a report still needs a number: an unmeasured row never passes (Lead's review of #1153)
    if (report ? !measured || !hardOk : !ok) pass = false;
    lines.push({ name, r, status: report ? (!measured ? 'FAIL (not measured)' : !hardOk ? `FAIL (over the full-tier hard ${hard})` : ok ? 'REPORT (within)' : 'REPORT (over)') : ok ? 'PASS' : 'FAIL' });
  }
  return { pass, lines };
}
