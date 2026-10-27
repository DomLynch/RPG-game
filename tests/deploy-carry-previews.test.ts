// scripts/deploy.sh carry_previews: the outgoing release's /preview/ is hard-linked into the new release before the switch, and a
// carry that does not leave the new release with previews fails loudly (non-zero) instead of switching without them (09a81037, 2026-10-07).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const deploy = readFileSync(join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');
const fn = deploy.slice(deploy.indexOf('# carry-previews begin'), deploy.indexOf('# carry-previews end'));
const root = () => {
  const dir = mkdtempSync(join(tmpdir(), 'carry-previews-'));
  mkdirSync(join(dir, 'current'));
  mkdirSync(join(dir, 'next'));
  return dir;
};
const run = (dir: string) => spawnSync('bash', ['-c', `set -euo pipefail\n${fn}\ncd '${dir}'\ncarry_previews next`], { encoding: 'utf8' });

test('the outgoing release previews are carried into the new release', () => {
  const dir = root();
  mkdirSync(join(dir, 'current', 'preview', 'origins'), { recursive: true });
  writeFileSync(join(dir, 'current', 'preview', 'origins', 'index.html'), 'p');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /previews carried: 1 folders/);
  assert.ok(existsSync(join(dir, 'next', 'preview', 'origins', 'index.html')));
});

test('a release with no previews to carry is untouched and succeeds', () => {
  const dir = root();
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(dir, 'next', 'preview')));
});

test('a failed carry exits non-zero so the switch never happens without previews', () => {
  const dir = root();
  mkdirSync(join(dir, 'current', 'preview'), { recursive: true });
  writeFileSync(join(dir, 'next', 'preview'), 'a file, not a directory');
  const r = run(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /carry-previews/);
});

test('a preview 404 is recorded, not raised, before the verifier install: the release finishes installing and the failure comes last', () => {
  const check = deploy.indexOf('|| previews_ok=0');
  const verifier = deploy.indexOf('deploy_step "verifier"');
  const raise = deploy.indexOf('previews missing');
  assert.ok(check > 0 && verifier > check, 'the preview check runs before the verifier step');
  assert.ok(raise > deploy.indexOf('Published %s'), 'the failure is raised after the Published line, after the verifier install');
  assert.ok(!/previews_ok=0[^\n]*exit/.test(deploy), 'the check itself does not exit');
  assert.match(deploy.slice(raise - 120, raise + 120), /LIVE/, 'the message says the release is live');
});

// nginx drift (2026-10-22: K6q17 #3568 and K6q19 #3582 each changed the vhost, the installed conf differed until provision.sh ran, and the drift set previews_ok=0, so the train raised
// "previews missing" for a healthy release). A drift the release itself explains is a PROVISION PENDING line; an unexplained one still stops.
const driftFn = deploy.slice(deploy.indexOf('# nginx-drift begin'), deploy.indexOf('# nginx-drift end'));
const git = (dir: string, ...args: string[]) => {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const repo = (conf: boolean, other: boolean) => {
  const dir = mkdtempSync(join(tmpdir(), 'nginx-drift-'));
  git(dir, 'init', '-q');
  mkdirSync(join(dir, 'deploy'));
  mkdirSync(join(dir, 'ops', 'nginx'), { recursive: true });
  writeFileSync(join(dir, 'deploy', 'frankendom.com.conf'), 'a');
  writeFileSync(join(dir, 'ops', 'nginx', 'x.conf'), 'a');
  writeFileSync(join(dir, 'other.txt'), 'a');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'one');
  const before = git(dir, 'rev-parse', 'HEAD');
  if (conf) writeFileSync(join(dir, 'deploy', 'frankendom.com.conf'), 'b');
  if (other) writeFileSync(join(dir, 'other.txt'), 'b');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '--allow-empty', '-m', 'two');
  return { dir, before, after: git(dir, 'rev-parse', 'HEAD') };
};
const expected = (dir: string, live: string, rev: string) => spawnSync('bash', ['-c', `set -euo pipefail\n${driftFn}\ncd '${dir}'\nnginx_drift_expected '${live}' '${rev}'`], { encoding: 'utf8' }).status;

test('a drift is expected only when this release changes the vhost files', () => {
  const changed = repo(true, false);
  assert.equal(expected(changed.dir, changed.before, changed.after), 0, 'deploy/frankendom.com.conf changed: the provision follows the publish');
  const nginxDir = repo(false, false);
  writeFileSync(join(nginxDir.dir, 'ops', 'nginx', 'x.conf'), 'b');
  git(nginxDir.dir, 'add', '-A'); git(nginxDir.dir, 'commit', '-q', '-m', 'three');
  assert.equal(expected(nginxDir.dir, nginxDir.before, git(nginxDir.dir, 'rev-parse', 'HEAD')), 0, 'ops/nginx changed too');
  const unrelated = repo(false, true);
  assert.equal(expected(unrelated.dir, unrelated.before, unrelated.after), 1, 'a release that leaves the vhost alone has no explanation for a drift');
});

test('an unknown or malformed outgoing live sha never explains a drift', () => {
  const r = repo(true, false);
  assert.equal(expected(r.dir, '', r.after), 1, 'empty (live unreadable)');
  assert.equal(expected(r.dir, 'not-a-sha', r.after), 1, 'malformed');
  assert.equal(expected(r.dir, 'f'.repeat(40), r.after), 1, 'a sha the checkout does not have');
});

test('deploy.sh stops on drift only through the unexplained branch, and says PROVISION PENDING otherwise', () => {
  const site = deploy.slice(deploy.indexOf('nginx_drift=$(bash scripts/provision.sh --dry-run'), deploy.indexOf('|| previews_ok=0', deploy.indexOf('nginx_drift=$(bash scripts/provision.sh --dry-run')));
  assert.match(site, /if nginx_drift_expected "\$\{live_now:-\}" "\$revision"; then echo "nginx: PROVISION PENDING/, 'the expected case prints PROVISION PENDING');
  assert.match(site, /else previews_ok=0; fi/, 'the unexplained case still records the failure');
  assert.equal((site.match(/previews_ok=0/g) ?? []).length, 1, 'previews_ok=0 appears exactly once in the drift block');
});
