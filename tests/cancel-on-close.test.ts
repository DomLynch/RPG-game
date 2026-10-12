// .github/workflows/cancel-on-close.yml cancels a closed PR's unfinished runs, but only when it closed UNMERGED (Lead + Strategy 2026-10-12: CO #2331
// merged and its release-checks + unit-ci runs on 7ac7e0e6b were cancelled, the receipt deploy.sh needed). The job's own `if:` evaluated for both events.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wf = readFileSync('.github/workflows/cancel-on-close.yml', 'utf8');

test('cancel-on-close runs only for a PR closed without merging', () => {
  const cond = /\n {2}cancel:\n {4}if: (.+)\n/.exec(wf)?.[1];
  assert.equal(cond, 'github.event.pull_request.merged != true', 'the cancel job is gated on merged');
  // the Actions expression, evaluated for the two close events (GitHub sends merged: true | false)
  const runs = (merged: boolean) => new Function('github', `return ${cond};`)({ event: { pull_request: { merged } } });
  assert.equal(runs(true), false, 'a merged PR keeps its runs (its receipt)');
  assert.equal(runs(false), true, 'an unmerged close still cancels');
  assert.match(wf, /on:\n {2}pull_request:\n {4}types: \[closed\]/);
});
