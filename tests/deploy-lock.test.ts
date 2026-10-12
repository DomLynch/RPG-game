// scripts/lib/deploy-lock.sh (release pipelining): two deploy.sh runs may be in flight, only the publish window is exclusive. Every lock
// lives in a tmp dir (DEPLOY_LOCK and friends), never ~/.claude/state. The legacy marker the hooks and rollback.sh read always names a live
// run; a publish lock held by a live run is waited for, a dead holder's is broken; a candidate the live release contains is "superseded".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lib = join(process.cwd(), 'scripts', 'lib', 'deploy-lock.sh');
const deadPid = () => { const r = spawnSync('sh', ['-c', 'echo $$']); return Number(String(r.stdout).trim()); };   // a pid that has exited
const box = () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-lock-'));
  const env = { ...process.env, DEPLOY_LOCK: join(dir, 'deploy_in_flight.json'), DEPLOY_RUNS_DIR: join(dir, 'runs'),
    DEPLOY_PUBLISH_LOCK: join(dir, 'publish.lock'), DEPLOY_ROWS_LOCK: join(dir, 'rows.lock'), DEPLOY_LOCK_POLL_S: '1' };
  const bash = (body: string, extra: Record<string, string> = {}) => spawnSync('bash', ['-c', `set -euo pipefail\nsource '${lib}'\n${body}`], { encoding: 'utf8', env: { ...env, ...extra } });
  return { dir, env, bash };
};
const marker = (pid: number, revision: string) => `{"revision":"${revision}","started":"x","pid":${pid},"cwd":"/x"}\n`;

test('the marker: a finishing run hands the legacy file to a live run, or removes it when none is left', () => {
  const { dir, env, bash } = box();
  mkdirSync(env.DEPLOY_RUNS_DIR);
  writeFileSync(join(env.DEPLOY_RUNS_DIR, `${process.pid}.json`), marker(process.pid, 'n'));   // run N, alive (this test's own pid)
  const r = bash('deploy_lock_take n1; grep -q "\\"pid\\":$$" "$DEPLOY_LOCK"; deploy_lock_release');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(env.DEPLOY_LOCK, 'utf8'), marker(process.pid, 'n'), 'N+1 finished first: the legacy marker names N, still alive');
  rmSync(join(env.DEPLOY_RUNS_DIR, `${process.pid}.json`));
  writeFileSync(join(env.DEPLOY_RUNS_DIR, '1.json'), marker(deadPid(), 'killed'));   // a run killed without its trap
  const last = bash('deploy_lock_take n2; deploy_lock_release');
  assert.equal(last.status, 0, last.stderr);
  assert.ok(!existsSync(env.DEPLOY_LOCK), 'no live run left: the legacy marker is gone');
  assert.ok(!existsSync(join(env.DEPLOY_RUNS_DIR, '1.json')), 'the dead run file is swept');
  rmSync(dir, { recursive: true });
});

test('the marker: a finishing run never removes a legacy marker another run holds', () => {
  const { env, bash } = box();
  const r = bash(`deploy_lock_take a; printf '%s' '${marker(process.pid, 'other').trim()}' > "$DEPLOY_LOCK"; deploy_lock_release`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(env.DEPLOY_LOCK, 'utf8'), marker(process.pid, 'other').trim());
});

test('publish lock: a live holder is waited for, then given up on with its name; nothing is broken', () => {
  const { env, bash } = box();
  mkdirSync(env.DEPLOY_PUBLISH_LOCK); writeFileSync(join(env.DEPLOY_PUBLISH_LOCK, 'pid'), `${process.pid}\n`); writeFileSync(join(env.DEPLOY_PUBLISH_LOCK, 'revision'), 'aaaa');
  const r = bash('deploy_lock_wait "$DEPLOY_PUBLISH_LOCK" publish', { DEPLOY_LOCK_WAIT_S: '2' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, new RegExp(`publish lock: still held by pid ${process.pid} \\(aaaa\\) after 2s; giving up`));
  assert.equal(readFileSync(join(env.DEPLOY_PUBLISH_LOCK, 'pid'), 'utf8').trim(), String(process.pid), 'the live holder keeps its lock');
});

test('publish lock: a dead holder is broken at once; the taker drops it on exit', () => {
  const { env, bash } = box();
  mkdirSync(env.DEPLOY_PUBLISH_LOCK); writeFileSync(join(env.DEPLOY_PUBLISH_LOCK, 'pid'), `${deadPid()}\n`);
  const r = bash('revision=bbbb; deploy_lock_wait "$DEPLOY_PUBLISH_LOCK" publish; [[ "$(cat "$DEPLOY_PUBLISH_LOCK/pid")" == $$ ]]; deploy_lock_release', { DEPLOY_LOCK_WAIT_S: '1' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /publish lock: holder pid \d+ is dead, breaking it/);
  assert.ok(!existsSync(env.DEPLOY_PUBLISH_LOCK), 'released by the EXIT path');
});

test('publish lock: N+1 waits while N publishes and takes the lock the moment N drops it', async () => {
  const { env } = box();
  mkdirSync(env.DEPLOY_PUBLISH_LOCK); writeFileSync(join(env.DEPLOY_PUBLISH_LOCK, 'pid'), `${process.pid}\n`);
  const child = spawn('bash', ['-c', `set -euo pipefail\nsource '${lib}'\ndeploy_lock_wait "$DEPLOY_PUBLISH_LOCK" publish\necho TAKEN`], { env: { ...env, DEPLOY_LOCK_WAIT_S: '60' } });
  let out = '';
  child.stdout.on('data', chunk => { out += chunk; });
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.doesNotMatch(out, /TAKEN/, 'N still holds the lock');
  rmSync(env.DEPLOY_PUBLISH_LOCK, { recursive: true });   // N drops it
  const status = await new Promise(resolve => child.on('exit', resolve));
  assert.equal(status, 0);
  assert.match(out, /publish lock: taken after \d+s\nTAKEN/);
});

test('superseded: a candidate the live release contains publishes nothing; anything else goes ahead', () => {
  const { dir, bash } = box();
  const repo = join(dir, 'repo');
  const git = (...args: string[]) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).stdout.trim();
  mkdirSync(repo); git('init', '-q');
  const commit = (m: string) => { git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', m); return git('rev-parse', 'HEAD'); };
  const n = commit('N'), n1 = commit('N+1');
  git('checkout', '-q', '-b', 'side', n); const side = commit('side');
  const verdict = (live: string, rev: string) => bash(`cd '${repo}'; deploy_superseded '${live}' '${rev}'`).stdout.trim();
  assert.equal(verdict(n1, n), 'superseded', 'N+1 is live: N must not roll it back');
  assert.equal(verdict(n, n1), 'ok');
  assert.equal(verdict(n, side), 'ok', 'a sibling is not contained');
  assert.equal(verdict('', n), 'ok', 'live unknown: go ahead (the cmp checks verify)');
  assert.equal(verdict(n, n), 'ok', 'a same-revision redeploy');
});

test('deploy.sh: only the publish window is exclusive, and the old whole-run rm is gone', () => {
  const s = readFileSync(join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');
  const at = (needle: string) => { const i = s.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };
  assert.doesNotMatch(s, /rm -f "\$DEPLOY_LOCK"/);
  assert.ok(at('deploy_lock_take') < at("trap 'deploy_lock_release"));
  assert.ok(at('deploy_step "release checks"') < at('deploy_lock_wait "$DEPLOY_ROWS_LOCK"'));
  assert.ok(at('deploy_lock_wait "$DEPLOY_ROWS_LOCK"') < at('trusted_checks=$(node scripts/ci-trusted-checks.mjs'), 'the CI lookup runs after any wait');
  assert.ok(at('node scripts/release-checks.mjs') < at('deploy_lock_drop "$DEPLOY_ROWS_LOCK"'));
  assert.ok(at('deploy_lock_drop "$DEPLOY_ROWS_LOCK"') < at('deploy_lock_wait "$DEPLOY_PUBLISH_LOCK"'));
  assert.ok(at('deploy_lock_wait "$DEPLOY_PUBLISH_LOCK"') < at('deploy_superseded "$live_now"'));
  assert.ok(at('deploy_superseded "$live_now"') < at('deploy_step "transfer + switch"'));
  assert.ok(at('scripts/lib/prune-releases.sh') < at('deploy_lock_drop "$DEPLOY_PUBLISH_LOCK"'));
  assert.ok(at('deploy_lock_drop "$DEPLOY_PUBLISH_LOCK"') < at('if [[ "$previews_ok" != 1 ]]'));
});

test('release-worktree: N+1 gets the slot no live run is using; a dirty slot is refused; env files and installs follow the lock file', () => {
  const { dir, env } = box();
  const repo = join(dir, 'repo'), a = join(dir, 'slot-a'), b = join(dir, 'slot-b');
  const git = (...args: string[]) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).stdout.trim();
  mkdirSync(repo); git('init', '-q');
  writeFileSync(join(repo, 'package-lock.json'), '{}\n'); writeFileSync(join(repo, '.gitignore'), '.env*.local\nnode_modules/\n');
  git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'N');
  const n = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, '.env.production.local'), 'VITE_SENTRY_DSN=x\n');
  const script = join(process.cwd(), 'scripts', 'release-worktree.sh'), installs = join(dir, 'installs');
  const pick = (sha: string) => spawnSync('bash', [script, sha], { cwd: repo, encoding: 'utf8',
    env: { ...env, RELEASE_SLOTS: `${a} ${b}`, RELEASE_WORKTREE_INSTALL: `sh -c 'echo x >> ${installs}'` } });
  const first = pick(n);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim(), a, 'no run in flight: the first slot');
  assert.ok(existsSync(join(a, '.env.production.local')), 'the build env is copied');
  mkdirSync(env.DEPLOY_RUNS_DIR, { recursive: true });
  writeFileSync(join(env.DEPLOY_RUNS_DIR, `${process.pid}.json`), `{"revision":"${n}","started":"x","pid":${process.pid},"cwd":"${a}"}\n`);   // N is deploying from slot a
  const second = pick(n);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout.trim(), b, 'N+1 gets the other slot');
  assert.equal(readFileSync(installs, 'utf8'), 'x\nx\n', 'one install per new slot');
  rmSync(join(env.DEPLOY_RUNS_DIR, `${process.pid}.json`));
  assert.equal(pick(n).stdout.trim(), a, 'slot a free again; same lock file: no reinstall');
  assert.equal(readFileSync(installs, 'utf8'), 'x\nx\n');
  writeFileSync(join(a, 'package-lock.json'), '{"dirty":1}\n');
  const dirty = pick(n);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /has tracked changes; refusing/);
  assert.equal(readFileSync(join(a, 'package-lock.json'), 'utf8'), '{"dirty":1}\n', 'never cleaned');
});
