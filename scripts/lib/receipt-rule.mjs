// The one rule for "is this workflow's receipt in?" (hardening item 3, Dom's priority via Strategy 2026-10-13: gates read receipts, never run states).
// A workflow's receipt is its verdict job (unit-ci/receipt, quality/quality, release-checks/summary). Read from a PR's statusCheckRollup:
//   green = the latest attempt that carries a verdict is SUCCESS, and no newer attempt is still running;
//   red   = the latest attempt that carries a verdict is FAILURE (or TIMED_OUT, ACTION_REQUIRED, STARTUP_FAILURE);
//   wait  = no receipt yet: the verdict job is missing, queued, running, CANCELLED, SKIPPED, or only has attempts that never ran.
// Cancelled and skipped never mean pass and never mean fail: they mean "no receipt yet", so a gate waits (a skipped required check counts as passing in a
// GitHub ruleset, which is why the verdict jobs themselves fail closed; see unit-ci.yml and release-checks.yml).
export const RECEIPT_WORKFLOWS = [['unit-ci', 'receipt'], ['quality', 'quality'], ['release-checks', 'summary']];

const up = x => String(x ?? '').toUpperCase();
const t = x => Date.parse(x.startedAt || x.completedAt || '') || 0;
const VERDICTS = ['SUCCESS', 'FAILURE', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];

/** The state of one verdict job across all its attempts on the head. */
export function verdictState(attempts) {
  const done = attempts.filter(c => c.status === 'COMPLETED' && VERDICTS.includes(up(c.conclusion))).sort((a, b) => t(a) - t(b)).at(-1);
  if (!done) return 'wait';
  const running = attempts.some(c => c.status !== 'COMPLETED' && t(c) >= t(done));   // a newer attempt in flight (queued attempts carry no start time: any non-completed one counts)
  const queued = attempts.some(c => c.status !== 'COMPLETED' && !t(c));
  if (running || queued) return 'wait';
  return up(done.conclusion) === 'SUCCESS' ? 'green' : 'red';
}

/** { state: 'green' | 'red' | 'wait', green: [wf/name], red: [wf/name], wait: [wf/name] } for the three verdict jobs; red beats wait beats green. */
export function receiptState(rollup, workflows = RECEIPT_WORKFLOWS) {
  const runs = Array.isArray(rollup) ? rollup.filter(c => c.__typename !== 'StatusContext') : [];
  const out = { green: [], red: [], wait: [] };
  for (const [wf, name] of workflows) out[verdictState(runs.filter(c => c.workflowName === wf && c.name === name))].push(`${wf}/${name}`);
  return { state: out.red.length ? 'red' : out.wait.length ? 'wait' : 'green', ...out };
}
