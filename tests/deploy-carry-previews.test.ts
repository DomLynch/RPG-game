// scripts/deploy.sh carry_previews: the outgoing release's /preview/ is hard-linked into the new release before the switch, and a
// carry that does not leave the new release with previews fails loudly (non-zero) instead of switching without them (09a81037, 2026-10-07).
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
