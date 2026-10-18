// Overlapping publishes (Lead GO 2026-10-18, Dom: "get this live"): with POST_PUBLISH_DETACH=1 deploy.sh leaves the CI-routed post-publish rows to scripts/release-train-postcheck.sh, which the train
// publisher starts after it releases the hold. The tail holds the NEXT publish on a red or unproved row and never rolls back or re-trusts one.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('deploy.sh: the detached tail is opt-in (POST_PUBLISH_DETACH=1), skips the CI wait and the stamp promote only on that path, and prints the line the publisher reads', () => {
  const deploy = readFileSync('scripts/deploy.sh', 'utf8');
  assert.match(deploy, /if \[\[ "\$\{POST_PUBLISH_DETACH:-0\}" == 1 && -n "\$pp_open" \]\]; then/);
  assert.match(deploy, /echo "post-publish CI tail: rows \$pp_open for \$revision \(detached/);
  assert.match(deploy, /else\n    post_publish=\$\(post_publish_ci_collect "\$revision" "\$pp_all" "\$pp_open"\)/, 'the default path still waits for CI');
  // The Mac group (which can roll back) runs BEFORE the branch, inside the hold.
  assert.ok(deploy.indexOf('post_publish_rows "$revision" "$mac_deferred" "$mac_rollback"') < deploy.indexOf('POST_PUBLISH_DETACH'));
});

test('release-train-publish.sh: releases the hold, THEN starts the tail from its own checkout, only when deploy.sh printed the tail line', () => {
  const pub = readFileSync('scripts/release-train-publish.sh', 'utf8');
  const release = pub.indexOf('rm -f "$hold" "$hold.stale-told"');
  const spawn = pub.indexOf('release-train-postcheck.sh');
  assert.ok(release > 0 && spawn > release, 'the tail starts after the hold is released');
  assert.match(pub, /\^post-publish CI tail: rows/);
  assert.match(pub, /if \[ -n "\$tail_rows" \]; then/);
  assert.match(pub, /"\$\(dirname "\$0"\)\/release-train-postcheck\.sh"/, 'run from the train checkout, not a release slot');
});
