// .github/workflows/cancel-on-close.yml cancels only the closed PR's own runs: same branch AND same head sha (Auditor, run 38252733109: closing the
// superseded CR #2346 cancelled 7 of the 8 runs of the re-cut CR #2347, which reuses the branch release-CR). The workflow's own jq filter is run on a fixture.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('a run on another sha of the same branch survives the close; the closed head\'s unfinished runs are cancelled', () => {
  const wf = readFileSync('.github/workflows/cancel-on-close.yml', 'utf8');
  const filter = /--jq '([^']+)'/.exec(wf)?.[1];
  assert.ok(filter, 'the cancel step lists runs through one --jq filter');
  const old = 'a'.repeat(40), recut = 'b'.repeat(40);
  const runs = [
    { databaseId: 1, status: 'in_progress', headSha: old, name: 'release-checks' },
    { databaseId: 2, status: 'queued', headSha: old, name: 'unit-ci' },
    { databaseId: 3, status: 'completed', headSha: old, name: 'quality' },
    { databaseId: 4, status: 'in_progress', headSha: recut, name: 'release-checks' },   // the re-cut on the same branch
    { databaseId: 5, status: 'queued', headSha: recut, name: 'unit-ci' },
    { databaseId: 6, status: 'in_progress', headSha: old, name: 'cancel-on-close' },
  ];
  const r = spawnSync('jq', ['-r', filter!], { input: JSON.stringify(runs), encoding: 'utf8', env: { ...process.env, HEAD_SHA: old } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n').map(Number), [1, 2], 'only the closed head\'s unfinished runs; the re-cut\'s 4 and 5 survive');
  assert.match(wf, /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});
