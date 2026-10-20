// scripts/ci-trusted-checks.mjs: DISPATCH FIRST (Dom 2026-10-20 via Strategy). A tree with no release-checks run gets one workflow_dispatch on the trunk ref
// (ref=<sha>) when deploy.sh asks for it (CI_DISPATCH_IF_MISSING=1) and gives a wait window; without either it only looks, as before. A failed dispatch
// changes nothing: nothing is trusted, every row runs locally. gh is a stub; no network.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
// `gh run list` finds nothing; `gh workflow run` records its arguments (or fails when GH_DISPATCH_FAIL is set).
const stub = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-dispatch-first-')), gh = join(dir, 'gh'), calls = join(dir, 'calls');
  writeFileSync(gh, `#!/bin/sh\nif [ "$1" = "workflow" ]; then echo "$@" >> '${calls}'; [ -n "$GH_DISPATCH_FAIL" ] && { echo "HTTP 500" >&2; exit 1; }; exit 0; fi\necho '[]'\n`);
  chmodSync(gh, 0o755);
  return { gh, calls };
};
const run = (env: Record<string, string>) => {
  const { gh, calls } = stub();
  const r = spawnSync(process.execPath, ['scripts/ci-trusted-checks.mjs', sha], { encoding: 'utf8', env: { ...process.env, CI_TRUST_GH: gh, CI_ROWS_POLL_S: '1', ...env } });
  return { r, calls: existsSync(calls) ? readFileSync(calls, 'utf8') : '' };
};

test('no run for the tree + CI_DISPATCH_IF_MISSING=1 + a wait window: one release-checks dispatch on the trunk ref with ref=<sha>', () => {
  const { r, calls } = run({ CI_DISPATCH_IF_MISSING: '1', CI_ROWS_WAIT_S: '2', TRUNK_BRANCH: 'trunk-x' });
  assert.equal(calls.trim().split('\n').length, 1, 'exactly one dispatch');
  assert.match(calls, new RegExp(`workflow run release-checks.yml --ref trunk-x -f ref=${sha}`));
  assert.match(r.stderr, /no release-checks run for tree .*: dispatched one on trunk-x/);
  assert.equal(r.stdout.trim(), '', 'nothing trusted until the run reports');
});

test('without the flag, or without a wait window, nothing is dispatched (look once, as before)', () => {
  assert.equal(run({ CI_ROWS_WAIT_S: '2' }).calls, '', 'no flag');
  assert.equal(run({ CI_DISPATCH_IF_MISSING: '1' }).calls, '', 'no wait window');
});

test('a failed dispatch (GitHub HTTP 500) is named and nothing is trusted: every row runs locally', () => {
  const { r, calls } = run({ CI_DISPATCH_IF_MISSING: '1', CI_ROWS_WAIT_S: '2', GH_DISPATCH_FAIL: '1' });
  assert.equal(calls.trim().split('\n').length, 1, 'tried once, not in a loop');
  assert.match(r.stderr, /dispatch failed .*HTTP 500.*all checks run locally/);
  assert.equal(r.stdout.trim(), '');
  assert.equal(r.status, 0, 'the deploy is not stopped by it');
});
