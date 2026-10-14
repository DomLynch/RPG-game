import NET_ROWS from './net-rules.json' with { type: 'json' };

// The zone page's client-plumbing numbers as rows (net-rules.json; Dom's data-layer rule 2026-10-13): how long a socket, a token renewal or a kill report is waited on or retried.
// The page imports the JSON directly (the shared loader's door is src/core/index.ts, which these node-testable files do not take); tests/net-rules checks the rows.
const VALUES = new Map(NET_ROWS.netRule.map((r) => [r.id, r.value]));
export function netRule(id: string): number {
  const v = VALUES.get(id);
  if (v === undefined) throw new Error(`net-rules.json has no row "${id}"`);
  return v;
}
