// Post-publish rows (Lead + Strategy 2026-10-13): rows 9 and 46, the candidate CI's tail (854 s and 458 s), run right AFTER Published instead of gating it. CI leaves them out of a
// candidate's matrix, deploy.sh defers them (RELEASE_CHECKS_DEFERRED) and runs them once the release is live (scripts/lib/post-publish.sh), and a failure there is a RED line,
// exit 1 (the release train stops and keeps its hold) and a deploy_hold for the next publish, never a silent pass.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GPU_ONLY, MAC_ROWS, planLine, POST_PUBLISH, POST_PUBLISH_ROWS, postPublishRowsFor } from '../scripts/lib/row-placement.mjs';

const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8'));
const deploy = readFileSync('scripts/deploy.sh', 'utf8');

test('POST_PUBLISH: rows 9 and 46, real release rows, on no other placement list, each with a measured reason', () => {
  assert.deepEqual(POST_PUBLISH_ROWS, [9, 46, 3, 15, 17, 19, 23, 24, 25, 32, 10, 11, 38, 39]);
  for (const entry of POST_PUBLISH) {
    assert.ok(entry.row >= 1 && entry.row <= gate.release_commands.length, `row ${entry.row} exists`);
    assert.ok(entry.ci_s >= 0 && entry.why.length > 10 && entry.date);
    assert.ok(!MAC_ROWS.includes(entry.row) && !GPU_ONLY.includes(entry.row), `row ${entry.row} is already placed elsewhere`);
  }
  assert.match(gate.release_commands[8].join(' '), /polearm-browser-check/);
  assert.match(gate.release_commands[45].join(' '), /desktop-intro-check/);
});

test('release-checks.yml: a pull request (a candidate) leaves the post-publish rows out of its matrix; a dispatch still runs them', () => {
  const yml = readFileSync('.github/workflows/release-checks.yml', 'utf8');
  assert.match(yml, /\.\.\.\(pr \? execFileSync\("node", \["scripts\/lib\/row-placement\.mjs", "post-publish"\], \{ encoding: "utf8", input: files\.join/);
  assert.ok(!/CI_POST_PUBLISH_ROWS/.test(yml), 'the static list is gone: the rows come from the diff');
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
  const defer = deploy.indexOf('RELEASE_CHECKS_DEFERRED="$post_publish');
  const published = deploy.indexOf("printf '\\nPublished %s");
  const drop = deploy.indexOf('deploy_lock_drop "$DEPLOY_PUBLISH_LOCK"');
  const run = deploy.indexOf('post_publish_rows "$revision" "$post_publish"');
  const end = deploy.lastIndexOf('[[ "$post_rc" == 0 ]] || exit 1');
  assert.ok(defer > 0 && defer < published && published < drop && drop < run && run < end, 'order: defer < Published < lock drop < post-publish < exit');
  assert.match(deploy, /DEPLOY_POST_PUBLISH:-on\}" != off \]\]; then[\s\S]*post_publish=\$\(git diff --name-only "\$pp_live" "\$revision" \| node scripts\/lib\/row-placement\.mjs post-publish\)/, 'DEPLOY_POST_PUBLISH=off restores the old behaviour; the rows come from the diff against live');
  assert.match(deploy, /source scripts\/lib\/post-publish\.sh/);
});

const withRollback = (root: string, run: string, rollback: string, hold: string) => spawnSync('bash', ['-c', `source ${join(process.cwd(), 'scripts/lib/post-publish.sh')}; post_publish_rows abc123 44 "$RB"`], {
  encoding: 'utf8', cwd: root, env: { ...process.env, RB: rollback, POST_PUBLISH_RUN: run, DEPLOY_HOLD_FILE: hold },
});

test('post_publish_rows: a failing row runs the rollback command, says ROLLED BACK, and still holds and returns 1; a pass never rolls back', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-rb-')), hold = join(root, 'deploy_hold'), marker = join(root, 'rolled');
  try {
    const ok = withRollback(root, 'true', `touch ${marker}`, hold);
    assert.equal(ok.status, 0);
    assert.ok(!existsSync(marker), 'a pass does not roll back');
    const bad = withRollback(root, 'exit 3', `touch ${marker}`, hold);
    assert.equal(bad.status, 1);
    assert.ok(existsSync(marker) && existsSync(hold), 'rolled back and held');
    assert.match(bad.stderr, /ROLLED BACK: rows 44 failed for abc123/);
    rmSync(marker);
    const broken = withRollback(root, 'exit 3', 'exit 7', hold);
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /ROLLBACK FAILED: rows 44 failed for the LIVE release abc123/);
    const none = withRollback(root, 'exit 3', '', hold);
    assert.equal(none.status, 1);
    assert.ok(!/ROLLED BACK|ROLLBACK FAILED/.test(none.stderr), 'no rollback command: the old behaviour');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deploy.sh: Mac rows after Published is off by default, runs first with a rollback to the outgoing release, and only when the writer was left as it was', () => {
  assert.match(deploy, /DEPLOY_MAC_AFTER_PUBLISH:-off/);
  assert.match(deploy, /RELEASE_CHECKS_DEFERRED="\$post_publish\$\{mac_deferred:\+/);
  assert.match(deploy, /\$writer_install" == \*"nothing installed"\*/);
  assert.match(deploy, /mac_rollback_release\(\) \{\n    DEPLOY_LOCK=\/dev\/null bash scripts\/rollback\.sh \"\$live_now\" \|\| return 1/);
  assert.match(deploy, /presence_now=\$\(ssh [^\n]*readlink \/opt\/frankendom-presence\/current[^\n]*\n    if \[\[ -n \"\$presence_prev\" && \"\$presence_now\" != \"\$presence_prev\" \]\]; then presence_back \|\| return 1; fi/, 'a publish that moved presence puts it back after the site swap (#2513)');
  assert.ok(deploy.indexOf('rollback.sh "$live_now"') < deploy.indexOf('then presence_back'), 'the site is swapped first, then presence');
  assert.ok(deploy.indexOf('"$mac_deferred" "$mac_rollback"') < deploy.indexOf('post_publish_rows "$revision" "$post_publish"'), 'the Mac rows run before the other post-publish rows');
});

test('post_publish_rows: the rollback may be a shell function of the caller (deploy.sh passes mac_rollback_release); its failure is ROLLBACK FAILED, still held, still 1', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-fn-')), hold = join(root, 'deploy_hold'), marker = join(root, 'fn-ran');
  try {
    const run = (fn: string) => spawnSync('bash', ['-c', `source ${join(process.cwd(), 'scripts/lib/post-publish.sh')}; rb() { ${fn}; }; post_publish_rows abc123 44 rb`], { encoding: 'utf8', cwd: root, env: { ...process.env, POST_PUBLISH_RUN: 'exit 3', DEPLOY_HOLD_FILE: hold, M: marker } });
    const ok = run('touch "$M"');
    assert.equal(ok.status, 1);
    assert.ok(existsSync(marker), 'the caller\'s function ran');
    assert.match(ok.stderr, /ROLLED BACK/);
    const bad = run('return 1');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /ROLLBACK FAILED: rows 44 failed for the LIVE release abc123/);
    assert.ok(existsSync(hold));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const ALWAYS = [9, 46], FINISHER_ROWS = [3, 15, 17, 19, 23, 24, 25, 32];

test('postPublishRowsFor: a diff of shared files only (scripts/, ops/, tests/) defers every post-publish row', () => {
  assert.deepEqual(postPublishRowsFor(['scripts/deploy.sh', 'ops/install-presence.sh', 'tests/x.test.ts']).sort((a, b) => a - b), [...POST_PUBLISH_ROWS].sort((a, b) => a - b));
  assert.deepEqual(postPublishRowsFor([]).sort((a, b) => a - b), [...POST_PUBLISH_ROWS].sort((a, b) => a - b));
});

test('postPublishRowsFor: a row stays PRE-publish when the diff touches its own family; rows 9 and 46 are always deferred', () => {
  const finisher = postPublishRowsFor(['src/fight/gore.ts']);
  for (const row of FINISHER_ROWS) assert.ok(!finisher.includes(row), `finisher row ${row} stays before Published`);
  for (const row of [10, 11, 38, 39, ...ALWAYS]) assert.ok(finisher.includes(row), `row ${row} is still deferred`);
  for (const file of ['src/fight/catalogue-data.ts', 'src/assets/rigs/humanoid.ts', 'public/world/rig.glb']) {
    const rows = postPublishRowsFor([file]);
    for (const row of FINISHER_ROWS) assert.ok(!rows.includes(row), `${file} keeps finisher row ${row} before Published (a finisher retime or a rig change)`);
  }
  const polearm = postPublishRowsFor(['src/fight/weapons.ts']);
  assert.ok(!polearm.includes(10) && !polearm.includes(11) && polearm.includes(3) && polearm.includes(38));
  const layout = postPublishRowsFor(['src/style.css']);
  assert.ok(!layout.includes(38) && layout.includes(39));
  const loot = postPublishRowsFor(['src/loot-data.ts']);
  assert.ok(!loot.includes(39) && loot.includes(38));
  assert.ok(ALWAYS.every(row => postPublishRowsFor(['src/fight/gore.ts', 'src/style.css', 'src/loot-data.ts', 'src/fight/weapons.ts']).includes(row)));
});

test('postPublishRowsFor: an unknown diff (null) defers only the rows without a family; the rows Lead keeps pre-publish are never listed', () => {
  assert.deepEqual(postPublishRowsFor(null), ALWAYS);
  for (const kept of [14, 37, 50]) assert.ok(!POST_PUBLISH_ROWS.includes(kept), `row ${kept} stays before Published`);
  assert.match(gate.release_commands[13].join(' '), /account-browser-check/);
  assert.match(gate.release_commands[36].join(' '), /desktop-layout-check/);
  assert.match(gate.release_commands[49].join(' '), /first-loss-browser-check/);
});

test('row-placement.mjs post-publish: reads the changed files on stdin, --unknown reads none', () => {
  const run = (args: string[], input: string) => execFileSync('node', ['scripts/lib/row-placement.mjs', 'post-publish', ...args], { encoding: 'utf8', input }).trim();
  assert.equal(run([], 'scripts/deploy.sh\n').split(',').length, POST_PUBLISH_ROWS.length);
  assert.equal(run(['--unknown'], ''), '9,46');
  assert.ok(!run([], 'src/fight/gore.ts\n').split(',').includes('3'));
});

// EB drill 2026-10-13: after ROLLED BACK, rows 9,46 still ran against the rolled-back sha and printed "the release is live".
const afterRollback = (root: string) => spawnSync('bash', ['-c', `source ${join(process.cwd(), 'scripts/lib/post-publish.sh')}; post_publish_rows abc123 44 "true" || true; post_publish_rows abc123 9,46; echo "second=$?"`], {
  encoding: 'utf8', cwd: root, env: { ...process.env, POST_PUBLISH_RUN: `echo ran >> ${join(root, 'ran')}; [ -e ${join(root, 'first-done')} ] || { touch ${join(root, 'first-done')}; exit 3; }`, DEPLOY_HOLD_FILE: join(root, 'deploy_hold') },
});

test('post_publish_rows: once a rollback ran, no later row starts and none says "live" for the rolled-back sha (the EB drill replay)', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-after-rb-'));
  try {
    const r = afterRollback(root);
    assert.match(r.stderr, /ROLLED BACK: rows 44 failed for abc123/);
    assert.equal(readFileSync(join(root, 'ran'), 'utf8').trim().split('\n').length, 1, 'only the first group ran');
    assert.ok(!/post-publish rows 9,46 for abc123: running now, the release is live/.test(r.stdout), 'no "live" line for the rolled-back sha');
    assert.match(r.stderr, /post-publish rows 9,46 SKIPPED for abc123: it was rolled back/);
    assert.match(r.stdout, /second=1/, 'the skipped group still fails the run');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('post_publish_rows: POST_PUBLISH_LIVE_CMD must name the row\'s target revision, else the rows do not start', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-publish-live-'));
  const run = (live: string, rowRun: string) => spawnSync('bash', ['-c', `source ${join(process.cwd(), 'scripts/lib/post-publish.sh')}; post_publish_rows abc123 9`], { encoding: 'utf8', cwd: root, env: { ...process.env, POST_PUBLISH_RUN: rowRun, POST_PUBLISH_LIVE_CMD: `echo ${live}`, DEPLOY_HOLD_FILE: join(root, 'h') } });
  try {
    assert.equal(run('abc123', 'true').status, 0);
    const bad = run('other999', `touch ${join(root, 'ran')}`);
    assert.equal(bad.status, 1);
    assert.ok(!existsSync(join(root, 'ran')), 'the row did not start');
    assert.match(bad.stderr, /live is other999, not abc123/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deploy.sh: gives the post-publish rows the live-revision lookup', () => {
  assert.match(readFileSync(join(process.cwd(), 'scripts/deploy.sh'), 'utf8'), /POST_PUBLISH_LIVE_CMD=.*release\.json/);
});
