// scripts/lib/sweep-tool-drift.sh (Lead 2026-10-21): the installed /usr/local/sbin/vps-scratch-sweep is a hand-copied delete tool that nothing installs, so the post-publish tail compares its sha256 with
// ops/vps-scratch-sweep at the live revision and prints a WARN naming both shas on a mismatch. It never fails the release, never holds and never installs. The ssh read and the `git show` are stubbed.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const REV = 'a'.repeat(40);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const FILE = '#!/usr/bin/env bash\necho the tool\n';   // with a trailing newline: the hash must match the file byte for byte
const drift = (env: Record<string, string>) => spawnSync('bash', ['-c', 'source scripts/lib/sweep-tool-drift.sh; sweep_tool_drift "$1"; echo "rc=$?"', 'x', REV], { encoding: 'utf8', env: { ...process.env, ...env } });

test('sweep_tool_drift: installed == repo prints OK and returns 0', () => {
  const r = drift({ SWEEP_DRIFT_REPO_CMD: `printf '%s' '${FILE.replace(/'/g, "'\\''")}'`, SWEEP_DRIFT_REMOTE_CMD: `echo '${sha(FILE)}  /usr/local/sbin/vps-scratch-sweep'` });
  assert.match(r.stdout, new RegExp(`^OK sweep-tool: installed == ops/vps-scratch-sweep at aaaaaaaa \\(${sha(FILE).slice(0, 8)}\\)`)); assert.match(r.stdout, /rc=0/);
});

test('sweep_tool_drift: a stubbed MISMATCH prints one WARN naming both shas and the revision, says nothing is installed or failed, and returns 0', () => {
  const stale = sha('an older tool');
  const r = drift({ SWEEP_DRIFT_REPO_CMD: `printf '%s' '${FILE.replace(/'/g, "'\\''")}'`, SWEEP_DRIFT_REMOTE_CMD: `echo '${stale}  /usr/local/sbin/vps-scratch-sweep'` });
  assert.match(r.stdout, /^WARN sweep-tool drift: /); assert.ok(r.stdout.includes(`at aaaaaaaa is ${sha(FILE).slice(0, 8)}, installed is ${stale.slice(0, 8)}`), r.stdout);
  assert.match(r.stdout, /reinstall by hand/); assert.match(r.stdout, /release is not failed and nothing is installed/); assert.match(r.stdout, /rc=0/);
  assert.equal(r.stdout.trim().split('\n').filter((l) => l.startsWith('WARN')).length, 1, 'one WARN line');
});

test('sweep_tool_drift: an unreadable installed file is a WARN, not a failure; an unreadable repo file warns and never reaches ssh; SWEEP_DRIFT_OFF skips', () => {
  const marker = join(mkdtempSync(join(tmpdir(), 'drift-')), 'ssh-was-called');
  const repoOk = `printf '%s' '${FILE.replace(/'/g, "'\\''")}'`;
  const noRemote = drift({ SWEEP_DRIFT_REPO_CMD: repoOk, SWEEP_DRIFT_REMOTE_CMD: 'exit 255' });
  assert.match(noRemote.stdout, /^WARN sweep-tool: could not read \/usr\/local\/sbin\/vps-scratch-sweep/); assert.match(noRemote.stdout, /rc=0/);
  const garbage = drift({ SWEEP_DRIFT_REPO_CMD: repoOk, SWEEP_DRIFT_REMOTE_CMD: 'echo not-a-hash' });
  assert.match(garbage.stdout, /^WARN sweep-tool: could not read \/usr\/local\/sbin\/vps-scratch-sweep/, 'a non-sha answer is unreadable, not a mismatch');
  const noRepo = drift({ SWEEP_DRIFT_REPO_CMD: 'exit 128', SWEEP_DRIFT_REMOTE_CMD: `touch '${marker}'; echo '${sha(FILE)}  x'` });
  assert.match(noRepo.stdout, /^WARN sweep-tool: could not read ops\/vps-scratch-sweep at aaaaaaaa/); assert.equal(existsSync(marker), false, 'no ssh when the repo side could not be read');
  const emptyRepo = drift({ SWEEP_DRIFT_REPO_CMD: 'true', SWEEP_DRIFT_REMOTE_CMD: `echo '${sha('')}  x'` });
  assert.match(emptyRepo.stdout, /^WARN sweep-tool: could not read ops\/vps-scratch-sweep/, 'an empty read is unreadable, not the constant hash of nothing');
  const off = drift({ SWEEP_DRIFT_OFF: '1', SWEEP_DRIFT_REPO_CMD: repoOk, SWEEP_DRIFT_REMOTE_CMD: 'exit 1' });
  assert.equal(off.stdout.trim(), 'rc=0');
});

test('sweep_tool_drift: the real `git show` path hashes the committed file byte for byte (this checkout, HEAD)', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const committed = spawnSync('git', ['show', `${head}:ops/vps-scratch-sweep`], { encoding: 'buffer' }).stdout;
  const r = spawnSync('bash', ['-c', 'source scripts/lib/sweep-tool-drift.sh; sweep_tool_drift "$1"', 'x', head], { encoding: 'utf8', env: { ...process.env, SWEEP_DRIFT_REMOTE_CMD: `echo '${createHash('sha256').update(committed).digest('hex')}  x'` } });
  assert.match(r.stdout, /^OK sweep-tool: installed == ops\/vps-scratch-sweep at /, r.stdout);
});

// The tail prints it and goes on: a mismatch changes nothing about the outcome (rows proved on CI -> green, no hold, exit 0).
test('release-train-postcheck: a stubbed drift mismatch is a WARN line in the tail\'s log and the release still goes green: no hold, exit 0', () => {
  const state = mkdtempSync(join(tmpdir(), 'postcheck-drift-'));
  const trust = join(state, 'trust.sh'); writeFileSync(trust, '#!/bin/sh\necho "9,46,3"\n', { mode: 0o755 });
  const r = spawnSync('bash', ['scripts/release-train-postcheck.sh', REV, '9,46,3', ''], { encoding: 'utf8', env: { ...process.env, RELEASE_TRAIN_STATE: state, POST_PUBLISH_TRUSTED_CMD: trust, POSTCHECK_COMMENT: 'true', POST_PUBLISH_CI_SETTLE_S: '0', POST_PUBLISH_CI_WAIT_S: '1', RELEASE_TRAIN_NOTIFY: '',
    SWEEP_DRIFT_REPO_CMD: 'echo repo-side', SWEEP_DRIFT_REMOTE_CMD: `echo '${sha('stale')}  /usr/local/sbin/vps-scratch-sweep'` } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /release-train-postcheck: WARN sweep-tool drift: ops\/vps-scratch-sweep at aaaaaaaa is [0-9a-f]{8}, installed is [0-9a-f]{8}/);
  assert.equal(existsSync(join(state, 'deploy_hold')), false, 'a drift WARN never holds the next publish');
});
