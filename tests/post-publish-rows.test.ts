// Post-publish rows (Lead + Strategy 2026-10-13): rows 9 and 46, the candidate CI's tail (854 s and 458 s), run right AFTER Published instead of gating it. CI leaves them out of a
// candidate's matrix, deploy.sh defers them (RELEASE_CHECKS_DEFERRED) and runs them once the release is live (scripts/lib/post-publish.sh), and a failure there is a RED line,
// exit 1 (the release train stops and keeps its hold) and a deploy_hold for the next publish, never a silent pass.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GPU_ONLY, MAC_ROWS, planLine, POST_PUBLISH, POST_PUBLISH_ROWS } from '../scripts/lib/row-placement.mjs';

const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8'));
const deploy = readFileSync('scripts/deploy.sh', 'utf8');

test('POST_PUBLISH: rows 9 and 46, real release rows, on no other placement list, each with a measured reason', () => {
  assert.deepEqual(POST_PUBLISH_ROWS, [9, 46]);
  for (const entry of POST_PUBLISH) {
    assert.ok(entry.row >= 1 && entry.row <= gate.release_commands.length, `row ${entry.row} exists`);
    assert.ok(entry.ci_s > 0 && entry.why.length > 10 && entry.date);
    assert.ok(!MAC_ROWS.includes(entry.row) && !GPU_ONLY.includes(entry.row), `row ${entry.row} is already placed elsewhere`);
  }
  assert.match(gate.release_commands[8].join(' '), /polearm-browser-check/);
  assert.match(gate.release_commands[45].join(' '), /desktop-intro-check/);
});

test('release-checks.yml: a pull request (a candidate) leaves the post-publish rows out of its matrix; a dispatch still runs them', () => {
  const yml = readFileSync('.github/workflows/release-checks.yml', 'utf8');
  assert.match(yml, /import \{ POST_PUBLISH_ROWS \} from "\.\/scripts\/lib\/row-placement\.mjs"/);
  assert.match(yml, /const skipRows = \[\.\.\.process\.env\.CI_SKIP_ROWS\.split\(","\), \.\.\.\(pr \? process\.env\.CI_POST_PUBLISH_ROWS\.split\(","\) : \[\]\)\]\.map\(Number\)/);
});

test('planLine names the post-publish rows and no longer counts them as Mac rows', () => {
  const line = planLine(54, ['', '', '', '', '', '9,46']);
  assert.match(line, /post-publish 2 \(9,46\)/);
  assert.ok(!/ 9,46/.test(line.split('Mac')[1]?.split(';')[0] || ''), 'not listed under Mac');
});

/** A scratch repo with a 3-row gate; row 2 drops a marker file when it runs. */
function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-'));
  const rows = [['node', '-e', 'require("fs").writeFileSync("ran1","1")'], ['node', '-e', 'require("fs").writeFileSync("ran2","1")'], ['node', '-e', 'require("fs").writeFileSync("ran3","1")']];
  writeFileSync(join(root, '.quality-gate.json'), JSON.stringify({ release_commands: rows }));
  for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x']]) execFileSync('git', args, { cwd: root });
  return root;
}
const checks = (root: string, env: Record<string, string>) => spawnSync('node', [join(process.cwd(), 'scripts/release-checks.mjs'), root], { encoding: 'utf8', env: { ...process.env, RELEASE_CHECK_CONCURRENCY: '1', ...env } });

test('release-checks.mjs: a deferred row does not run, is recorded as deferred, and the run is not stamped full', () => {
  const root = scratch();
  try {
    const r = checks(root, { RELEASE_CHECKS_DEFERRED: '2' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(existsSync(join(root, 'ran1')) && existsSync(join(root, 'ran3')) && !existsSync(join(root, 'ran2')), 'rows 1 and 3 ran, row 2 did not');
    assert.match(r.stdout, /1 deferred to run right after Published: 2/);
    const receipt = JSON.parse(readFileSync(join(root, 'artifacts', 'release-checks.json'), 'utf8'));
    assert.equal(receipt.checks_detail.find((c: { index: number }) => c.index === 2).deferred, true);
    assert.ok(!existsSync(join(root, 'artifacts', 'last-full-release.json')), 'a run with a deferred row is not a full run');
    const pending = JSON.parse(readFileSync(join(root, 'artifacts', 'pending-full-release.json'), 'utf8'));
    assert.equal(pending.revision, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'a PENDING stamp waits for the post-publish rows');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release-checks.mjs: the post-publish run (RELEASE_CHECKS_ONLY, deferral cleared) runs just that row, into its own receipt', () => {
  const root = scratch();
  try {
    const r = checks(root, { RELEASE_CHECKS_ONLY: '2', RELEASE_CHECKS_DEFERRED: '', RELEASE_CHECKS_RECEIPT: join(root, 'artifacts', 'post.json'), RELEASE_CHECKS_LOG_DIR: join(root, 'artifacts', 'post') });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(existsSync(join(root, 'ran2')) && !existsSync(join(root, 'ran1')) && !existsSync(join(root, 'ran3')));
    assert.ok(existsSync(join(root, 'artifacts', 'post.json')) && !existsSync(join(root, 'artifacts', 'release-checks.json')), 'the release receipt is untouched');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const lib = (root: string, rows: string, run: string, hold: string) => spawnSync('bash', ['-c', `source ${join(process.cwd(), 'scripts/lib/post-publish.sh')}; post_publish_rows abc123 "$ROWS"`], {
  encoding: 'utf8', cwd: root, env: { ...process.env, ROWS: rows, POST_PUBLISH_RUN: run, DEPLOY_HOLD_FILE: hold },
});

test('post_publish_rows: a pass prints one line and holds nothing; no rows is a no-op', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-lib-')), hold = join(root, 'deploy_hold');
  try {
    const ok = lib(root, '9,46', 'test "$RELEASE_CHECKS_ONLY" = 9,46 && test -z "$RELEASE_CHECKS_DEFERRED"', hold);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /post-publish rows 9,46 passed for abc123/);
    assert.ok(!existsSync(hold));
    const none = lib(root, '', 'exit 9', hold);
    assert.equal(none.status, 0);
    assert.equal(none.stdout, '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('post_publish_rows: a failing row is a RED line, returns 1 and writes deploy_hold (first line without digits); an existing hold is not overwritten', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-lib-')), hold = join(root, 'deploy_hold');
  try {
    const bad = lib(root, '9,46', 'exit 3', hold);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /RED: post-publish rows 9,46 FAILED for the LIVE release abc123/);
    const text = readFileSync(hold, 'utf8');
    assert.ok(!/\d/.test(text.split('\n')[0]), 'no digit on the first line: the train reads digits there as a publisher pid');
    assert.match(text, /rows 9,46 revision abc123/);
    writeFileSync(hold, '4242\n');
    lib(root, '9,46', 'exit 3', hold);
    assert.equal(readFileSync(hold, 'utf8'), '4242\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('post_publish_rows: the pending full-run stamp is PROMOTED when the rows pass, and only for its own revision', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-lib-')), hold = join(root, 'deploy_hold');
  try {
    mkdirSync(join(root, 'artifacts'));
    writeFileSync(join(root, 'artifacts', 'pending-full-release.json'), JSON.stringify({ revision: 'abc123', at: 'now', fast_gate: false }) + '\n');
    const other = lib(root, '9,46', 'true', hold).stdout;
    assert.ok(existsSync(join(root, 'artifacts', 'last-full-release.json')), other);
    assert.equal(JSON.parse(readFileSync(join(root, 'artifacts', 'last-full-release.json'), 'utf8')).revision, 'abc123');
    assert.ok(!existsSync(join(root, 'artifacts', 'pending-full-release.json')));
    assert.match(other, /full-run stamp promoted for abc123/);
    // another revision's pending stamp is left alone and never promoted
    rmSync(join(root, 'artifacts', 'last-full-release.json'));
    writeFileSync(join(root, 'artifacts', 'pending-full-release.json'), JSON.stringify({ revision: 'zzz999' }) + '\n');
    lib(root, '9,46', 'true', hold);
    assert.ok(!existsSync(join(root, 'artifacts', 'last-full-release.json')) && existsSync(join(root, 'artifacts', 'pending-full-release.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('post_publish_rows: a failing row does NOT promote the pending stamp (and drops it)', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-lib-')), hold = join(root, 'deploy_hold');
  try {
    mkdirSync(join(root, 'artifacts'));
    writeFileSync(join(root, 'artifacts', 'pending-full-release.json'), JSON.stringify({ revision: 'abc123' }) + '\n');
    assert.equal(lib(root, '9,46', 'exit 3', hold).status, 1);
    assert.ok(!existsSync(join(root, 'artifacts', 'last-full-release.json')), 'no full stamp');
    assert.ok(!existsSync(join(root, 'artifacts', 'pending-full-release.json')), 'the pending stamp is dropped');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deploy.sh: the rows are deferred before Published, run after the publish lock drops, and a failure exits 1 at the very end', () => {
  const defer = deploy.indexOf('RELEASE_CHECKS_DEFERRED="$post_publish" node scripts/release-checks.mjs');
  const published = deploy.indexOf("printf '\\nPublished %s");
  const drop = deploy.indexOf('deploy_lock_drop "$DEPLOY_PUBLISH_LOCK"');
  const run = deploy.indexOf('post_publish_rows "$revision" "$post_publish"');
  const end = deploy.lastIndexOf('[[ "$post_rc" == 0 ]] || exit 1');
  assert.ok(defer > 0 && defer < published && published < drop && drop < run && run < end, 'order: defer < Published < lock drop < post-publish < exit');
  assert.match(deploy, /DEPLOY_POST_PUBLISH:-on\}" == off \]\] \|\| post_publish=/, 'DEPLOY_POST_PUBLISH=off restores the old behaviour');
  assert.match(deploy, /source scripts\/lib\/post-publish\.sh/);
});
