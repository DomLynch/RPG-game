// The T4 leg is gpu-only (Dom/Lead 2026-10-12, the 40-runner work): GPU_ONLY is exactly the T4 rows whose measured CPU (SwiftShader) time misses
// the 600 s row ceiling; every other row is CI's. hf-wall-rows' own launch test (tests/hf-wall-rows.test.ts) pins that only these rows are launched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GPU_ONLY, MAC_ONLY, MAC_ROWS, ON_T4, ROW_CEILING_S } from '../scripts/lib/row-placement.mjs';

test('GPU_ONLY is the ceiling rule over ON_T4; row 13 (initdb as root) and row 9 (369 s on CPU) are CI rows', () => {
  const expected = ON_T4.filter(e => e.row !== 13 && (e.cpu_s == null || e.cpu_s > ROW_CEILING_S)).map(e => e.row);
  assert.deepEqual([...GPU_ONLY].sort((a, b) => a - b), expected);
  assert.ok(!GPU_ONLY.includes(13) && !GPU_ONLY.includes(9));
});

// The plan step's own script, extracted from the workflow and run with a stub gh (the PR's changed files): CI never schedules a GPU_ONLY row.
const plan = (env: Record<string, string>) => {
  const yml = readFileSync('.github/workflows/release-checks.yml', 'utf8');
  const start = yml.indexOf('        run: |\n          # Rows CI never schedules'), end = yml.indexOf('\n      - id: group\n');   // the list step ends where the group step (row-groups.mjs packing, not shell of this script) begins
  assert.ok(start > 0 && end > start, 'the plan step');
  const script = yml.slice(start, end).split('\n').slice(1).map(line => line.slice(10)).join('\n');
  const dir = mkdtempSync(join(tmpdir(), 'gpu-only-plan-')), out = join(dir, 'out'), gh = join(dir, 'gh');
  writeFileSync(gh, '#!/bin/sh\necho src/main.ts\n'); chmodSync(gh, 0o755);
  writeFileSync(out, '');
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_OUTPUT: out,
    GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', PR_ACTION: 'opened', PR_LABEL: '', PR_LABELS: '', HEAD_REF: 'release-CK',
    RUN_REF: 'a'.repeat(40), RUNNER_SKIP_ON_PR: 'quiet-one-browser-check', ...env } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(/checks=(.*)/.exec(readFileSync(out, 'utf8'))![1]).map((c: { index: number }) => c.index) as number[];
};

test('the release-checks plan matrix and GPU_ONLY ∪ every MAC_ONLY row are disjoint: CI never schedules a row it will never trust', () => {
  const never = [...GPU_ONLY, ...MAC_ROWS];
  assert.deepEqual(MAC_ROWS, MAC_ONLY.map(e => e.row), 'all of MAC_ONLY, the list deploy.sh places on the Mac');
  for (const row of [2, 4, 22, 44, 45, 48, 49, 52, 54]) assert.ok(MAC_ROWS.includes(row), `row ${row} is the Mac's`);
  const rows = plan({});
  assert.ok(rows.length > 20, `a candidate still runs the matrix: ${rows.length} rows`);
  assert.deepEqual(rows.filter(r => never.includes(r)), []);
  assert.ok(rows.includes(13), 'the T4 rows that are not gpu-only are CI rows');
  // Rows 9 and 46 are POST_PUBLISH (row-placement.mjs): a candidate's matrix leaves them out (deploy.sh runs them right after Published); a dispatch measurement still runs them.
  assert.ok(!rows.includes(9) && !rows.includes(46), 'a candidate leaves the post-publish rows out');
  assert.ok(plan({ GITHUB_EVENT_NAME: 'workflow_dispatch' }).includes(9) && plan({ GITHUB_EVENT_NAME: 'workflow_dispatch' }).includes(46), 'a dispatch still runs them');
  assert.ok(!rows.includes(2) && !rows.includes(44), 'rows 2 and 44 (Mac-only for failing off the Mac) are not scheduled either');
  assert.deepEqual(plan({ GITHUB_EVENT_NAME: 'workflow_dispatch' }).filter(r => never.includes(r)), [], 'a dispatch run skips them too');
});
