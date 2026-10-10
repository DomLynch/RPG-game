import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Pre-launch at candidate open (Strategy/Dom 2026-10-10): scripts/pre-launch.sh starts the T4 wall rows and the CPU receipt job when a candidate opens;
// deploy.sh takes them when the deployed revision is that exact sha. These tests pin the take/skip rules; trust itself stays per row, per receipt, vs the deployed tree.
const SHA = 'a'.repeat(40), OTHER = 'b'.repeat(40);

// A fake `hf` that logs every `jobs run` (a launch) and answers the slot probe with an empty list.
function fakeHf(dir: string) {
  writeFileSync(join(dir, 'hf'), `#!/bin/bash
case "$1 $2" in
  "jobs run") echo "$*" >> "${dir}/launches"; echo "Job started with ID: fresh1";;
  "jobs ps") echo '[]';;
  *) :;;
esac
`, { mode: 0o755 });
}
const wallState = (sha: string, ageMs = 0) => JSON.stringify({ jobId: 'pre1,pre2', jobs: [{ id: 'pre1', rows: [1, 8] }, { id: 'pre2', rows: [14] }], sha, rows: [1, 8, 14], flavor: 't4-medium', width: '4', launchedAt: Date.now() - ageMs });

test('deploy-hf.sh takes the pre-launched T4 jobs for the same sha, and launches its own for another sha or a stale file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prelaunch-wall-'));
  fakeHf(dir);
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, HF_WALL_ROWS_HF: join(dir, 'hf'), PRELAUNCH_DIR: dir, HF_WALL_ROWS_STATE: join(dir, 'deploy-state'), HF_WALL_ROWS_ENV_FILE: join(dir, 'none') };
  const sh = (revision: string) => execFileSync('bash', ['-c', `exec 2>&1; source scripts/lib/deploy-hf.sh; revision=${revision}; placed_skip=""; hf_wall_rows_launch; echo "job=$hf_job planned=$hf_wall_planned"`], { encoding: 'utf8', env });
  writeFileSync(join(dir, `${SHA}.wall`), wallState(SHA));
  const reused = sh(SHA);
  assert.match(reused, /reusing the pre-launched job\(s\) pre1,pre2/);
  assert.match(reused, /job=pre1,pre2 planned=1,8,14/);
  assert.equal(existsSync(join(dir, 'launches')), false, 'no `hf jobs run`: the pre-launched jobs are used');
  assert.equal(JSON.parse(readFileSync(join(dir, 'deploy-state'), 'utf8')).sha, SHA, 'collect reads the copied state file');
  // Another revision: the file named for it does not exist, so deploy.sh launches as before.
  assert.match(sh(OTHER), /job=fresh1/);
  assert.ok(existsSync(join(dir, 'launches')), 'a different sha launches its own');
  // The state file names another sha (a copied or renamed file): not taken.
  writeFileSync(join(dir, `${SHA}.wall`), wallState(OTHER));
  assert.doesNotMatch(sh(SHA), /reusing the pre-launched/);
  // Stale: older than PRELAUNCH_MAX_AGE_S.
  writeFileSync(join(dir, `${SHA}.wall`), wallState(SHA, 5 * 3600 * 1000));
  assert.doesNotMatch(sh(SHA), /reusing the pre-launched/);
});

test('deploy-vps.sh prelaunched_cpu returns the CPU job line for the same sha only while it is fresh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prelaunch-cpu-'));
  const run = (revision: string, extra = '') => spawnSync('bash', ['-c', `source scripts/lib/deploy-vps.sh; ${extra} prelaunched_cpu ${revision}`], { encoding: 'utf8', env: { ...process.env, PRELAUNCH_DIR: dir } });
  writeFileSync(join(dir, `${SHA}.cpu`), 'cpuJob1;2,3,5');
  const hit = run(SHA);
  assert.equal(hit.status, 0); assert.equal(hit.stdout, 'cpuJob1;2,3,5');
  assert.notEqual(run(OTHER).status, 0, 'another sha has no file');
  const old = new Date(Date.now() - 5 * 3600 * 1000);
  utimesSync(join(dir, `${SHA}.cpu`), old, old);
  assert.notEqual(run(SHA).status, 0, 'older than 4 h is not taken');
  writeFileSync(join(dir, `${SHA}.cpu`), '');
  assert.notEqual(run(SHA).status, 0, 'an empty file is not a job');
});

test('deploy.sh asks for the pre-launched CPU job before launching its own', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.match(deploy, /cpu_out=\$\(prelaunched_cpu "\$revision" \|\| node scripts\/vps-shadow\/launch\.mjs cpu "\$revision" "\$placed_skip" \|\| true\)/);
});

test('pre-launch.sh refuses a bad or unknown sha, and writes the T4 state file under PRELAUNCH_DIR for a known one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prelaunch-script-'));
  fakeHf(dir);
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, HF_WALL_ROWS_HF: join(dir, 'hf'), PRELAUNCH_DIR: dir, HF_WALL_ROWS_ENV_FILE: join(dir, 'none') };
  assert.equal(spawnSync('bash', ['scripts/pre-launch.sh', 'nonsense'], { env, encoding: 'utf8' }).status, 2, 'needs a 40-hex sha');
  assert.equal(spawnSync('bash', ['scripts/pre-launch.sh', SHA], { env, encoding: 'utf8' }).status, 2, 'a sha this checkout does not have');
  let head = '';
  try { head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return; }   // a clone without history (the VPS work copies): the rest needs one
  const ran = spawnSync('bash', ['scripts/pre-launch.sh', head], { env, encoding: 'utf8', timeout: 120_000 });
  assert.equal(ran.status, 0, ran.stderr);
  const state = JSON.parse(readFileSync(join(dir, `${head}.wall`), 'utf8'));
  assert.equal(state.sha, head); assert.ok(state.jobId, 'a T4 job id is recorded'); assert.ok(Date.now() - state.launchedAt < 120_000);
});
