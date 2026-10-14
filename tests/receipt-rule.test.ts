// Hardening item 3 (gates read receipts, never run states): ONE rule for the publisher, the queue summary and the unit receipt.
// cancelled / skipped / missing / running = "no receipt yet" = wait; SUCCESS = green; FAILURE = red; the latest attempt that carries a verdict decides.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RECEIPT_WORKFLOWS, receiptState, verdictState } from '../scripts/lib/receipt-rule.mjs';
import { missingRows, REQUIRED_ROWS } from '../scripts/release-train.mjs';

type Run = { __typename: 'CheckRun'; workflowName: string; name: string; status: string; conclusion: string | null; startedAt: string; completedAt?: string };
const run = (workflowName: string, name: string, conclusion: string | null, at: string, status = conclusion ? 'COMPLETED' : 'IN_PROGRESS'): Run =>
  ({ __typename: 'CheckRun', workflowName, name, status, conclusion, startedAt: `2026-10-13T${at}:00Z`, completedAt: conclusion ? `2026-10-13T${at}:30Z` : undefined });
const all = (c: string, at = '05:00') => RECEIPT_WORKFLOWS.map(([wf, n]) => run(wf, n, c, at));

test('all three verdict jobs SUCCESS is green; nothing is the same as wait, never green', () => {
  assert.equal(receiptState(all('SUCCESS')).state, 'green');
  assert.equal(receiptState([]).state, 'wait');
  assert.equal(receiptState(undefined).state, 'wait');
  assert.deepEqual(receiptState([]).wait, ['unit-ci/receipt', 'quality/quality', 'release-checks/summary']);
});

test('CANCELLED, SKIPPED and a still-running verdict are "no receipt yet" (wait), not red and not green', () => {
  for (const c of ['CANCELLED', 'SKIPPED']) {
    const r = receiptState([run('unit-ci', 'receipt', c, '05:00'), ...all('SUCCESS').slice(1)]);
    assert.equal(r.state, 'wait', c);
    assert.deepEqual(r.wait, ['unit-ci/receipt'], c);
  }
  const running = receiptState([run('quality', 'quality', null, '05:00'), run('unit-ci', 'receipt', 'SUCCESS', '05:00'), run('release-checks', 'summary', 'SUCCESS', '05:00')]);
  assert.equal(running.state, 'wait');
  assert.deepEqual(running.wait, ['quality/quality']);
});

test('FAILURE is red and beats wait; the latest attempt that carries a verdict decides (a rerun can turn red green and green red)', () => {
  assert.equal(receiptState([run('unit-ci', 'receipt', 'FAILURE', '05:00'), run('quality', 'quality', 'CANCELLED', '05:00'), run('release-checks', 'summary', 'SUCCESS', '05:00')]).state, 'red');
  const rerunGreen = [run('unit-ci', 'receipt', 'FAILURE', '05:00'), run('unit-ci', 'receipt', 'SUCCESS', '05:10'), ...all('SUCCESS').slice(1)];
  assert.equal(receiptState(rerunGreen).state, 'green', 'the later SUCCESS decides');
  const rerunRed = [run('unit-ci', 'receipt', 'SUCCESS', '05:00'), run('unit-ci', 'receipt', 'FAILURE', '05:10'), ...all('SUCCESS').slice(1)];
  assert.equal(receiptState(rerunRed).state, 'red', 'a later FAILURE beats the earlier SUCCESS (the old check only asked for any SUCCESS)');
});

test('a later CANCELLED or SKIPPED attempt (a superseded run, an inert label run) carries no receipt and never hides the real one; a later RUNNING one does make it wait', () => {
  for (const c of ['CANCELLED', 'SKIPPED']) assert.equal(receiptState([...all('SUCCESS', '05:00'), run('quality', 'quality', c, '05:20')]).state, 'green', `${c} after SUCCESS`);
  assert.equal(receiptState([...all('SUCCESS', '05:00'), run('quality', 'quality', null, '05:20')]).state, 'wait', 'a newer attempt is running');
  assert.equal(receiptState([...all('SUCCESS', '05:00'), run('quality', 'quality', null, '05:20', 'QUEUED')]).state, 'wait', 'a newer attempt is queued');
});

test('other workflows and status contexts never stand in for a verdict job', () => {
  const stray = [run('quality', 'receipt', 'SUCCESS', '05:00'), run('other', 'summary', 'SUCCESS', '05:00'), { __typename: 'StatusContext', context: 'quality', state: 'SUCCESS' }];
  assert.equal(receiptState(stray).state, 'wait');
});

test('verdictState on its own: only attempts that carry a verdict count', () => {
  assert.equal(verdictState([]), 'wait');
  assert.equal(verdictState([run('quality', 'quality', 'CANCELLED', '05:00')]), 'wait');
  assert.equal(verdictState([run('quality', 'quality', 'TIMED_OUT', '05:00')]), 'red');
});

test('the publisher uses the same rule: missingRows lists every verdict that is not green, wait and red alike, in REQUIRED_ROWS order', () => {
  assert.deepEqual(REQUIRED_ROWS, RECEIPT_WORKFLOWS);
  assert.deepEqual(missingRows(all('SUCCESS')), []);
  assert.deepEqual(missingRows([run('unit-ci', 'receipt', 'SUCCESS', '05:00'), run('quality', 'quality', 'CANCELLED', '05:00'), run('release-checks', 'summary', 'FAILURE', '05:00')]), ['quality/quality', 'release-checks/summary']);
  assert.deepEqual(missingRows([run('unit-ci', 'receipt', 'SUCCESS', '05:00'), run('unit-ci', 'receipt', 'FAILURE', '05:10'), ...all('SUCCESS').slice(1)]), ['unit-ci/receipt'], 'a later FAILURE of the verdict is missing, whatever came before');
});

// The queue summary and the unit receipt must FAIL CLOSED: a verdict job that is SKIPPED when its inputs failed reads as passing to a GitHub ruleset.
const text = (f: string) => readFileSync(f, 'utf8');
const job = (t: string, id: string) => { const at = t.indexOf(`\n  ${id}:\n`); const rest = t.slice(at + 1); const end = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/); return end < 0 ? rest : rest.slice(0, end + 1); };

test('unit-ci `receipt` runs when static or a shard failed (and goes red), and is skipped only when nothing was meant to run', () => {
  const j = job(text('.github/workflows/unit-ci.yml'), 'receipt');
  assert.match(j, /\n {4}needs: \[delta, static, shard\]\n/);
  assert.match(j, /\n {4}if: \$\{\{ !cancelled\(\) && \(needs\.delta\.outputs\.unchanged == 'true' \|\| !\(needs\.static\.result == 'skipped' && needs\.shard\.result == 'skipped'\)\) \}\}\n/, 'a red static skips the shards: the receipt must still run (only an unchanged delta, 2026-10-14, reports green without them)');
  assert.match(j, /STATIC: \$\{\{ needs\.static\.result \}\}/);
  assert.match(j, /\[ "\$SHARDS" = success \] \|\| \{[^\n]*exit 1/, 'the first step fails the job unless every shard succeeded');
  assert.ok(j.indexOf('STATIC') < j.indexOf('actions/checkout'), 'before any other step');
});

test('release-checks `summary` runs when the plan or a check failed (and fails), and is skipped only when the matrix is empty or the plan never ran', () => {
  const j = job(text('.github/workflows/release-checks.yml'), 'summary');
  assert.match(j, /\n {4}if: always\(\) && needs\.plan\.result != 'skipped' && \(needs\.plan\.result != 'success' \|\| needs\.plan\.outputs\.checks != '\[\]'\)\n/);
  assert.match(j, /\n {6}- name: Fail closed\n {8}if: always\(\) && \(github\.event_name == 'pull_request' \|\| github\.event_name == 'merge_group'\)\n/, 'a gating event only: a dispatch measures and gates nothing');
  assert.match(j, /PLAN_RESULT: \$\{\{ needs\.plan\.result \}\}/);
  assert.match(j, /CHECK_RESULT: \$\{\{ needs\.check\.result \}\}/);
  assert.ok(j.indexOf('Per-check table') < j.indexOf('Fail closed'), 'the guard is the LAST step, so the per-check table still prints on a failure');
  assert.match(j, /const gates = \["pull_request", "merge_group"\]\.includes\(process\.env\.GITHUB_EVENT_NAME\)/, 'a merge-queue entry fails on a red row exactly like a pull request');
  assert.match(j, /if \(gates && passed < rows\.length\)/);
});
