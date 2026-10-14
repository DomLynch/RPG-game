import PAGE_ROWS from './page-rules.json' with { type: 'json' };

// The zone page's feel and load-wait numbers as rows (page-rules.json; Dom's data-layer rule 2026-10-13): the touch sticks, the duel camera's ease, how long a warm-up step is waited on, a tap's limits and the turn rate.
// The page imports the JSON directly (the shared loader's door is src/core/index.ts, which node-testable files like sticks.ts do not take); origins/preview/page-rules.test.ts checks the rows.
const VALUES = new Map(PAGE_ROWS.pageRule.map((r) => [r.id, r.value]));
export function pageRule(id: string): number {
  const v = VALUES.get(id);
  if (v === undefined) throw new Error(`page-rules.json has no row "${id}"`);
  return v;
}
