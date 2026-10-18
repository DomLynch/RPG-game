// Overlapping publishes (Lead GO 2026-10-18, Dom: "get this live"): with POST_PUBLISH_DETACH=1 deploy.sh leaves the CI-routed post-publish rows to scripts/release-train-postcheck.sh, which the train
// publisher starts after it releases the hold. The tail holds the NEXT publish on a red or unproved row and never rolls back or re-trusts one.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const REV = 'a'.repeat(40);
/** Runs the tail with a stub trust command (prints `trusted` on stdout, or fails) and a stub PR commenter that appends to a file. */
function tail(trusted: string | null, rows = '9,46,3', opts: { existingHold?: boolean } = {}) {
  const state = mkdtempSync(join(tmpdir(), 'postcheck-'));
  const comments = join(state, 'comments.txt');
  const trust = join(state, 'trust.sh');
  writeFileSync(trust, trusted === null ? '#!/bin/sh\nexit 3\n' : `#!/bin/sh\necho "${trusted}"\n`, { mode: 0o755 });
  const commenter = join(state, 'comment.sh');
  writeFileSync(commenter, `#!/bin/sh\necho "$1" >> "${comments}"\n`, { mode: 0o755 });
  if (opts.existingHold) writeFileSync(join(state, 'deploy_hold'), 'someone else\n');
  const r = spawnSync('bash', ['scripts/release-train-postcheck.sh', REV, rows, '3175'], {
    encoding: 'utf8',
    env: { ...process.env, RELEASE_TRAIN_STATE: state, POST_PUBLISH_TRUSTED_CMD: trust, POSTCHECK_COMMENT: commenter, POST_PUBLISH_CI_SETTLE_S: '0', POST_PUBLISH_CI_WAIT_S: '1', RELEASE_TRAIN_NOTIFY: '' },
  });
  const hold = join(state, 'deploy_hold');
  const out = { status: r.status, stdout: r.stdout, stderr: r.stderr, hold: existsSync(hold) ? readFileSync(hold, 'utf8') : null, comments: existsSync(comments) ? readFileSync(comments, 'utf8') : '' };
  rmSync(state, { recursive: true, force: true });
  return out;
}

test('postcheck: every row proved on CI is one green line and one PR comment, and holds nothing', () => {
  const r = tail('3,9,46');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /post-publish rows 9,46,3 for a{40}: all CI-trusted/);
  assert.equal(r.hold, null, 'no hold');
  assert.match(r.comments, /all green on CI/);
});

test('postcheck: a row CI did not prove writes deploy_hold naming the rows and the revision, exit 1, comment says so', () => {
  const r = tail('9,46');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /RED: rows 3 not green on CI for the tree/);
  assert.match(r.hold ?? '', /rows 9,46,3 revision a{40}: rows 3 not green/);
  assert.match(r.comments, /NOT proved on CI/);
  assert.match(r.comments, /fixes forward/);
});

test('postcheck: nothing proved, or the trust lookup failing, fails CLOSED (hold written)', () => {
  assert.equal(tail('').status, 1);
  assert.match(tail('').hold ?? '', /rows 3,9,46 not green/);   // subtract lists ascending
  const failed = tail(null);
  assert.equal(failed.status, 1);
  assert.match(failed.hold ?? '', /the trust lookup failed/);
});

test('postcheck: an existing deploy_hold is never overwritten', () => {
  const r = tail('9', '9,46', { existingHold: true });
  assert.equal(r.status, 1);
  assert.equal(r.hold, 'someone else\n');
});

test('postcheck: records its pid in the pending marker while it runs and removes the marker on every exit (green and red)', () => {
  for (const trusted of ['3,9,46', '9']) {
    const state = mkdtempSync(join(tmpdir(), 'postcheck-marker-'));
    const marker = join(state, `post-publish-pending-${REV.slice(0, 8)}`);
    writeFileSync(marker, `rev=${REV}\nrows=9,46,3\nat=1700000000\n`);
    const trust = join(state, 'trust.sh');
    // the trust command reads the marker the tail wrote to itself: pid recorded, at kept
    writeFileSync(trust, `#!/bin/sh\ncp "${marker}" "${state}/seen"\necho "${trusted}"\n`, { mode: 0o755 });
    spawnSync('bash', ['scripts/release-train-postcheck.sh', REV, '9,46,3', ''], { encoding: 'utf8', env: { ...process.env, RELEASE_TRAIN_STATE: state, POST_PUBLISH_TRUSTED_CMD: trust, POST_PUBLISH_CI_SETTLE_S: '0', RELEASE_TRAIN_NOTIFY: '' } });
    assert.match(readFileSync(join(state, 'seen'), 'utf8'), new RegExp(`^rev=${REV}\\nrows=9,46,3\\nat=1700000000\\npid=\\d+\\n`));
    assert.equal(existsSync(marker), false, `marker removed when the tail ends (trusted ${trusted})`);
    rmSync(state, { recursive: true, force: true });
  }
});

test('postcheck: a TERM (what a Mac shutdown sends first) writes deploy_hold "interrupted" and KEEPS the pending marker, it never clears itself', async () => {
  const state = mkdtempSync(join(tmpdir(), 'postcheck-term-'));
  const marker = join(state, `post-publish-pending-${REV.slice(0, 8)}`);
  writeFileSync(marker, `rev=${REV}\nrows=9,46,3\nat=1700000000\n`);
  const trust = join(state, 'trust.sh');
  writeFileSync(trust, `#!/bin/sh\ntouch "${state}/waiting"\nsleep 30\necho 3,9,46\n`, { mode: 0o755 });
  const child = spawn('bash', ['scripts/release-train-postcheck.sh', REV, '9,46,3', ''], { detached: true, stdio: 'ignore', env: { ...process.env, RELEASE_TRAIN_STATE: state, POST_PUBLISH_TRUSTED_CMD: trust, POST_PUBLISH_CI_SETTLE_S: '0', RELEASE_TRAIN_NOTIFY: '' } });
  const closed = new Promise<number | null>(resolve => child.on('close', code => resolve(code)));
  try {
    for (let i = 0; i < 100 && !existsSync(join(state, 'waiting')); i++) await new Promise(r => setTimeout(r, 50));
    assert.ok(existsSync(join(state, 'waiting')), 'the tail is waiting on CI');
    process.kill(-child.pid!, 'SIGTERM');   // the whole group, as a shutdown does
    const code = await closed;
    assert.equal(code, 143);
    assert.equal(existsSync(marker), true, 'the marker survives a dying tail');
    assert.match(readFileSync(marker, 'utf8'), /pid=\d+/);
    assert.match(readFileSync(join(state, 'deploy_hold'), 'utf8'), /post-publish tail interrupted.*\nrows 9,46,3 revision a{40}/);
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('deploy.sh: the detached tail is opt-in (POST_PUBLISH_DETACH=1), skips the CI wait and the stamp promote only on that path, and prints the line the publisher reads', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.match(deploy, /if \[\[ "\$\{POST_PUBLISH_DETACH:-0\}" == 1 && -n "\$pp_open" \]\]; then/);
  assert.match(deploy, /echo "post-publish CI tail: rows \$detach_rows for \$revision \(detached/);
  assert.equal((deploy.match(/post_publish=\$\(post_publish_ci_collect "\$revision" "\$pp_all" "\$pp_open"\)/g) ?? []).length, 2, 'the default path (flag off) and the nothing-to-detach path still wait for CI');
  // The Mac group (which can roll back) runs BEFORE the branch, inside the hold.
  assert.ok(deploy.indexOf('post_publish_rows "$revision" "$mac_deferred" "$mac_rollback"') < deploy.indexOf('if [[ "${POST_PUBLISH_DETACH:-0}" == 1 && -n "$pp_open" ]]'));
});

test('postcheck (window): at the window close it dispatches ONE CI run for the NEWEST member, with the union of the rows, and names every member on green and on red', () => {
  for (const trusted of ['3,9,10,46', '3,9']) {
    const state = mkdtempSync(join(tmpdir(), 'postcheck-window-'));
    const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
    const marker = join(state, `post-publish-pending-${A.slice(0, 8)}`);
    const now = Math.floor(Date.now() / 1000);
    writeFileSync(marker, `rev=${A}\nrows=3,9\nat=${now - 5}\nwindow=1\nmember=${B} 9,10\nmember=${C} 3,46\n`);
    const trust = join(state, 'trust.sh'); writeFileSync(trust, `#!/bin/sh\necho "$1" > "${state}/trusted-for"\necho "${trusted}"\n`, { mode: 0o755 });
    const dispatch = join(state, 'dispatch.sh'); writeFileSync(dispatch, `#!/bin/sh\necho "$POST_PUBLISH_REV" >> "${state}/dispatched"\n`, { mode: 0o755 });
    const comments = join(state, 'comments.txt'); const commenter = join(state, 'comment.sh'); writeFileSync(commenter, `#!/bin/sh\necho "$1" >> "${comments}"\n`, { mode: 0o755 });
    const r = spawnSync('bash', ['scripts/release-train-postcheck.sh', A, '3,9', '3175'], { encoding: 'utf8', env: { ...process.env, RELEASE_TRAIN_STATE: state, POST_PUBLISH_TRUSTED_CMD: trust, POST_PUBLISH_DISPATCH: dispatch, POSTCHECK_COMMENT: commenter, POST_PUBLISH_CI_SETTLE_S: '0', POSTCHECK_WINDOW_TICK_S: '0.1', RELEASE_TRAIN_NOTIFY: '' } });
    assert.equal(readFileSync(join(state, 'dispatched'), 'utf8').trim().split('\n').length, 1, 'exactly ONE dispatch');
    assert.match(readFileSync(join(state, 'dispatched'), 'utf8'), new RegExp(C), 'against the newest member');
    assert.equal(readFileSync(join(state, 'trusted-for'), 'utf8').trim(), C, 'and the trust lookup is for it too');
    assert.match(r.stdout, new RegExp(`members ${A}, ${B}, ${C}`));
    assert.match(readFileSync(comments, 'utf8'), new RegExp(`window members: ${A} ${B} ${C}`), 'every member named');
    if (trusted === '3,9,10,46') { assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /rows 3,9,10,46 for c{40}: all CI-trusted/, 'rows are the union'); assert.equal(existsSync(join(state, 'deploy_hold')), false); }
    else { assert.equal(r.status, 1); assert.match(readFileSync(join(state, 'deploy_hold'), 'utf8'), new RegExp(`rows 10,46 not green on CI for the tree.*window members: ${A} ${B} ${C}`)); }
    assert.equal(existsSync(marker), false, 'decided either way: marker cleared');
    rmSync(state, { recursive: true, force: true });
  }
});

test('postcheck (window race, Auditor + Lead on #3214): the window is closed atomically BEFORE the members are read; a joiner that slips in after the read fails closed and is named in the hold', () => {
  const state = mkdtempSync(join(tmpdir(), 'postcheck-race-'));
  const A = 'a'.repeat(40), D = 'd'.repeat(40);
  const marker = join(state, `post-publish-pending-${A.slice(0, 8)}`);
  const now = Math.floor(Date.now() / 1000);
  writeFileSync(marker, `rev=${A}\nrows=3,9\nat=${now - 5}\nwindow=1\n`);
  // during the CI wait (after the members were read) a late publish appends to the CLOSED file's old path AND recreates a stray at the open name, as a racing joiner can
  const trust = join(state, 'trust.sh');
  writeFileSync(trust, `#!/bin/sh\nif [ -e "${marker}.closed" ]; then echo "closed-at-wait-time" > "${state}/saw-closed"; echo "member=${D} 3" >> "${marker}.closed"; fi\nprintf 'rev=${D}\\nrows=3\\nat=1\\nmember=${D} 3\\n' > "${marker}"\necho 3,9\n`, { mode: 0o755 });
  const dispatch = join(state, 'dispatch.sh'); writeFileSync(dispatch, '#!/bin/sh\ntrue\n', { mode: 0o755 });
  const r = spawnSync('bash', ['scripts/release-train-postcheck.sh', A, '3,9', ''], { encoding: 'utf8', env: { ...process.env, RELEASE_TRAIN_STATE: state, POST_PUBLISH_TRUSTED_CMD: trust, POST_PUBLISH_DISPATCH: dispatch, POST_PUBLISH_CI_SETTLE_S: '0', POSTCHECK_WINDOW_TICK_S: '0.1', RELEASE_TRAIN_NOTIFY: '' } });
  try {
    assert.ok(existsSync(join(state, 'saw-closed')), 'at the CI wait the marker was already the .closed name: a joiner finds no open window');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`${D} joined the window after its members were read: never proved on CI`));
    assert.match(readFileSync(join(state, 'deploy_hold'), 'utf8'), new RegExp(D), 'the hold names the late joiner');
    assert.equal(existsSync(marker), false, 'the stray at the open name is removed once named');
    assert.equal(existsSync(`${marker}.closed`), false);
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('deploy.sh (window): with detach AND a TAIL_MIN_INTERVAL_S window the release dispatches no CI run of its own (the window tail does)', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.match(deploy, /POST_PUBLISH_DETACH:-0\}" == 1 && "\$\{TAIL_MIN_INTERVAL_S:-0\}" =~ \^\[1-9\]\[0-9\]\*\$ \]\]; then export POST_PUBLISH_DISPATCH=true; fi/);
  assert.ok(deploy.indexOf('export POST_PUBLISH_DISPATCH=true') < deploy.indexOf('pp_open=$(post_publish_ci_start'), 'set before the CI step looks');
});

test('deploy.sh (IT fix): rows CI never proves (POST_PUBLISH_MAC_ROWS, default 9) run on the Mac inside the hold, only the rest is detached; nothing left to detach takes the old path', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.match(deploy, /detach_rows=\$\(_pp_left "\$pp_open" "\$\{POST_PUBLISH_MAC_ROWS:-9\}"\)/);
  assert.match(deploy, /post_publish=\$\(_pp_left "\$pp_open" "\$detach_rows"\)/, 'the Mac-first rows stay in post_publish, which post_publish_rows runs inside the hold');
  assert.match(deploy, /post-publish CI tail: rows \$detach_rows for \$revision/, 'the line the publisher reads names ONLY the detached rows');
  assert.match(deploy, /if \[\[ -n "\$detach_rows" \]\]; then[\s\S]*?else\n      post_publish=\$\(post_publish_ci_collect/, 'no detachable rows: the old, waiting path');
  // the subtraction itself, with the real helper: 9 is the Mac row, everything else detaches
  const r = spawnSync('bash', ['-c', 'source scripts/lib/post-publish.sh; open="3,9,10,46"; d=$(_pp_left "$open" "9"); m=$(_pp_left "$open" "$d"); echo "detach=$d mac=$m"; d2=$(_pp_left "9" "9"); echo "only9=[$d2]"'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /detach=3,10,46 mac=9/);
  assert.match(r.stdout, /only9=\[\]/, 'only the Mac row open: nothing to detach');
});

test('release-train-publish.sh (IT fix): the tail starts in its OWN session (perl setsid), so launchd ending the tick does not kill it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setsid-'));
  const out = join(dir, 'out');
  const stub = join(dir, 'stub.sh');
  writeFileSync(stub, `#!/bin/sh\necho "pid=$$ pgid=$(ps -o pgid= -p $$ | tr -d ' ') sid=$(ps -o sess= -p $$ | tr -d ' ')" > "${out}"\n`, { mode: 0o755 });
  const pub = readFileSync('scripts/release-train-publish.sh', 'utf8');
  assert.match(pub, /nohup perl -MPOSIX -e 'POSIX::setsid\(\); exec @ARGV' -- \$\{RELEASE_TRAIN_POSTCHECK:-/);
  // the very wrapper the publisher uses, run from a subshell like the publisher does
  const r = spawnSync('bash', ['-c', `( nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- "${stub}" > /dev/null 2>&1 & ); for i in $(seq 1 50); do [ -s "${out}" ] && break; sleep 0.1; done; cat "${out}"`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const m = /pid=(\d+) pgid=(\d+) sid=(\d+)/.exec(r.stdout);
  assert.ok(m, r.stdout);
  assert.equal(m[1], m[2], 'a process-group leader of its own group');
  assert.equal(m[1], m[3], 'and the leader of its own session');
  rmSync(dir, { recursive: true, force: true });
});

test('release-train-publish.sh: releases the hold, THEN starts the tail from its own checkout, only when deploy.sh printed the tail line', () => {
  const pub = readFileSync('scripts/release-train-publish.sh', 'utf8');
  const release = pub.indexOf('rm -f "$hold" "$hold.stale-told"');
  const marker = pub.indexOf('> "$marker"');
  const spawn = pub.indexOf('${RELEASE_TRAIN_POSTCHECK:-bash "$(dirname "$0")/release-train-postcheck.sh"}');
  assert.ok(marker > 0 && marker < release, 'the pending marker is written BEFORE the hold is released');
  assert.ok(release > 0 && spawn > release, 'the tail starts after the hold is released');
  assert.match(pub, /\^post-publish CI tail: rows/);
  assert.match(pub, /if \[ -z "\$joined" \] && \[ -n "\$tail_rows" \]; then/);
  assert.match(pub, /"\$\(dirname "\$0"\)\/release-train-postcheck\.sh"/, 'run from the train checkout, not a release slot');
});
