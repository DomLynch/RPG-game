// scripts/lib/release-lock-preflight.mjs: test:all refuses while a release run's marker is live, unless the release runner set its flag. Real files in a temp dir (RELEASE_LOCK_DIR);
// nothing here reads /run or any live box state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { buildRunner, parseReceipt } = await import('../scripts/lib/vps-unit.mjs');
const run = (dir: string, env: Record<string, string> = {}) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'FRANKENDOM_RELEASE_RUN'));
  return spawnSync(process.execPath, ['scripts/lib/release-lock-preflight.mjs'], { encoding: 'utf8', env: { ...clean, RELEASE_LOCK_DIR: dir, ...env } });
};
const marker = (dir: string, ageMin = 0) => { const f = join(dir, 'aaaa-bbbb'); writeFileSync(f, ''); const t = new Date(Date.now() - ageMin * 60_000); utimesSync(f, t, t); };

test('no lock dir and an empty lock dir let test:all start', () => {
  assert.equal(run(join(tmpdir(), 'no-such-lock-dir-xyz')).status, 0);
  assert.equal(run(mkdtempSync(join(tmpdir(), 'lock-'))).status, 0);
});

test('a live release marker refuses test:all and names the marker; the release runner flag lets it through', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-')); marker(dir);
  const r = run(dir);
  assert.equal(r.status, 1); assert.match(r.stderr, /test:all refused: a release run holds the box \(aaaa-bbbb\)/);
  assert.equal(run(dir, { FRANKENDOM_RELEASE_RUN: '1' }).status, 0);
  assert.equal(run(dir, { FRANKENDOM_RELEASE_RUN: '0' }).status, 1, 'only the exact flag value passes');
});

test('a marker older than 90 minutes is ignored (a crashed release cannot lock test:all forever)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-')); marker(dir, 91);
  assert.equal(run(dir).status, 0);
  const fresh = mkdtempSync(join(tmpdir(), 'lock-')); marker(fresh, 89);
  assert.equal(run(fresh).status, 1);
});

test('test:all runs the preflight first, the default dir is the one the runners write, and the runner sets the flag and records the max load in the receipt', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts['test:all'], /^node scripts\/lib\/release-lock-preflight\.mjs && node --test tests\/\*\.test\.ts$/);
  assert.match(readFileSync('scripts/lib/release-lock-preflight.mjs', 'utf8'), /'\/run\/frankendom-release'/);
  const script = buildRunner({ sha: 'a'.repeat(40), tree: 'b'.repeat(40), nonce: 'c'.repeat(32), runid: 'd'.repeat(16) });
  assert.match(script, /FRANKENDOM_RELEASE_RUN=1 npm run test:all/);
  assert.match(script, /cut -d' ' -f1 \/proc\/loadavg/); assert.match(script, /"max_load1":%s/);
  // the receipt line the runner prints with a max load still parses and keeps the figure
  const line = `RECEIPT ${'c'.repeat(32)} ${JSON.stringify({ sha: 'a'.repeat(40), tree: 'b'.repeat(40), runid: 'd', node: 'v22.23.3', node_tarball_sha256: script.match(/([0-9a-f]{64})  node\.tar\.xz/)![1], pass: 3, fail: 0, exit: 0, seconds: 9, max_load1: 2.5 })}`;
  const parsed = parseReceipt({ stdout: line, status: 0, nonce: 'c'.repeat(32), sha: 'a'.repeat(40), tree: 'b'.repeat(40) });
  assert.equal(parsed.ok, true, parsed.reason); assert.equal(parsed.receipt.max_load1, 2.5);
});
