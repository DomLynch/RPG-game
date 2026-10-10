// scripts/deploy.sh publishes the origins preview after the switch and fails the run when /zone1/ does not serve the bundle just built
// (deploy.sh only carried previews forward, so /zone1/ stayed on the 2026-10-08 build through Releases A to H).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const deploy = readFileSync(join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');
const at = (needle: string) => { const i = deploy.indexOf(needle); assert.ok(i > 0, `deploy.sh lacks: ${needle}`); return i; };

test('the origins preview is published after the live cmp checks and before the verifier install', () => {
  assert.ok(at('cmp dist/release.json') < at('scripts/publish-origins-preview.sh'));
  assert.ok(at('scripts/publish-origins-preview.sh') < at('deploy_step "verifier"'));
});

test('a /zone1/ bundle that differs from the built one marks previews not ok, raised at the end', () => {
  assert.match(deploy, /"\$built_bundle" != "\$live_bundle"[\s\S]{0,200}previews_ok=0/);
  assert.ok(at('scripts/publish-origins-preview.sh') < at('previews_ok=0'));
  assert.ok(at('printf \'\\nPublished') < at('if [[ "$previews_ok" != 1 ]]'));
});

test('DEPLOY_ORIGINS_PREVIEW=off skips the publish', () => {
  assert.match(deploy, /DEPLOY_ORIGINS_PREVIEW:-on\}" != off/);
});

test('the preview script runs through bash on a clean artifact folder, and an nginx conf drift fails the run loudly (Release I: no exec bit, stale build, /zone/ alias never installed)', () => {
  assert.match(deploy, /rm -rf artifacts\/origins-preview[^\n]*\n\s*bash scripts\/publish-origins-preview\.sh/);
  assert.match(deploy, /bash scripts\/provision\.sh --dry-run[\s\S]{0,400}previews_ok=0/);
});

test('publish-origins-preview.sh is executable in git', () => {
  const mode = spawnSync('git', ['ls-files', '-s', 'scripts/publish-origins-preview.sh'], { encoding: 'utf8' }).stdout.split(' ')[0];
  assert.equal(mode, '100755');
});
