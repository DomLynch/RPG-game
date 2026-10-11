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

test('the runner records the slowest test files from the TAP log (receipt field "slowest", slowest first, capped at 8, repo-relative names)', () => {
  const script = buildRunner({ sha: 'a'.repeat(40), tree: 'b'.repeat(40), nonce: 'c'.repeat(32), runid: 'd'.repeat(16) });
  const lines = script.split('\n'), at = lines.findIndex(l => l.startsWith('slowest=$(awk'));
  let end = at; while (!lines[end]!.includes('END{printf "]"}')) end++;
  const snippet = lines.slice(at, end + 1).join('\n');
  const dir = mkdtempSync(join(tmpdir(), 'slow-'));
  const tap = (name: string, ms: number, ok = true) => `    ok 1 - inner case\n      ---\n      duration_ms: 1.5\n      ...\n${ok ? '' : 'not '}ok 7 - /root/deploy-runs/x/src/tests/${name}.test.ts\n  ---\n  duration_ms: ${ms}\n  type: 'test'\n  ...\n`;
  writeFileSync(join(dir, 'unit.log'), tap('fast', 120) + tap('slow', 301234.5) + tap('mid', 9000) + Array.from({ length: 9 }, (_, i) => tap(`f${i}`, 1000 + i)).join(''));
  const r = spawnSync('bash', ['-c', `RUN='${dir}'\n${snippet}\nprintf '%s' "$slowest"`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const got = JSON.parse(r.stdout) as Array<[string, number]>;
  assert.equal(got.length, 8); assert.deepEqual(got[0], ['tests/slow.test.ts', 301.2]); assert.deepEqual(got[1], ['tests/mid.test.ts', 9]);
  assert.ok(got.every(([n]) => /^tests\/[a-z0-9]+\.test\.ts$/.test(n)), 'names are repo-relative');
  assert.match(script, /"slowest":%s/);
});

// The runner's REAL tail (from `slowest=$(awk` to before `exit`) run in bash on a fake unit.log + load.log, its stdout through parseReceipt (Auditor S1: dropping the "$slowest" argument
// printed `"slowest":}`, which parseReceipt refuses, so every VPS unit run would spill to HF).
const runTail = (mutate: (tail: string) => string = t => t) => {
  const sha = 'a'.repeat(40), tree = 'b'.repeat(40), nonce = 'c'.repeat(32);
  const script = buildRunner({ sha, tree, nonce, runid: 'd'.repeat(16) }), lines = script.split('\n');
  const from = lines.findIndex(l => l.startsWith('slowest=$(awk')), to = lines.findIndex((l, i) => i > from && l.startsWith('exit "$rc"'));
  const tail = mutate(lines.slice(from, to).join('\n'));
  const dir = mkdtempSync(join(tmpdir(), 'tail-'));
  const file = (name: string, ms: number) => `ok 1 - /root/deploy-runs/x/src/tests/${name}.test.ts\n  ---\n  duration_ms: ${ms}\n  ...\n`;
  writeFileSync(join(dir, 'unit.log'), file('a', 1200) + file('b', 4500) + '# pass 3447\n# fail 0\n');
  writeFileSync(join(dir, 'load.log'), '1.5\n2.5\n');
  const r = spawnSync('bash', ['-c', `RUN='${dir}'; NONCE=${nonce}; BOXTREE=${tree}; t0=$(date +%s); rc=0; maxload=2.5\n${tail}`], { encoding: 'utf8' });
  return { r, parsed: parseReceipt({ stdout: r.stdout, status: r.status ?? 1, nonce, sha, tree }) };
};
test('the runner tail prints a receipt parseReceipt accepts, with max_load1 and the slowest files, slowest first', () => {
  const { r, parsed } = runTail();
  assert.equal(parsed.ok, true, `${parsed.reason} | ${r.stdout} | ${r.stderr}`);
  assert.equal(parsed.receipt.max_load1, 2.5); assert.deepEqual(parsed.receipt.slowest, [['tests/b.test.ts', 4.5], ['tests/a.test.ts', 1.2]]);
});
test('the runner tail goes red when the slowest argument is dropped from the receipt printf (the receipt would be invalid JSON)', () => {
  const { parsed } = runTail(t => t.replace(' "${slowest:-[]}"', ''));
  assert.equal(parsed.ok, false, 'a receipt without the slowest argument must not parse');
});
