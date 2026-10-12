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
  assert.match(r.stdout, /publish lock: waiting on aaaa \(pid \d+\) for 0s/);
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

// One fixture history: N-1 is live; N and N+1 are trunk merge commits (N+1 stacked on N); X is a candidate cut beside N (not on it).
const history = (dir: string) => {
  const repo = join(dir, 'repo');
  const git = (...args: string[]) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).stdout.trim();
  mkdirSync(repo); git('init', '-q');
  const commit = (m: string) => { git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', m); return git('rev-parse', 'HEAD'); };
  const prev = commit('N-1'), n = commit('N'), n1 = commit('N+1');
  git('checkout', '-q', '-b', 'side', prev); const x = commit('X');
  return { repo, prev, n, n1, x };
};

test('publish order: forward only; N+1 finishing first makes N superseded, never a rollback; a diverged tree is refused', () => {
  const { dir, bash } = box();
  const { repo, prev, n, n1, x } = history(dir);
  const order = (live: string, rev: string) => bash(`cd '${repo}'; deploy_publish_order '${live}' '${rev}'`).stdout.trim();
  // N+1's rows finish first: it publishes over N-1, then N arrives at the lock.
  assert.equal(order(prev, n1), 'forward');
  assert.equal(order(n1, n), 'superseded', 'N+1 is live and contains N: N publishes nothing');
  // In order: N then N+1.
  assert.equal(order(prev, n), 'forward');
  assert.equal(order(n, n1), 'forward');
  // X was cut beside N, not on it: whichever of the two publishes second is refused, so neither tree is silently lost.
  assert.equal(order(n, x), 'diverged');
  assert.equal(order(x, n), 'diverged');
  assert.equal(order('', n), 'unknown', 'release.json unreadable: deploy.sh logs it and publishes');
  assert.equal(order(n, n), 'forward', 'a same-revision redeploy');
});

test('deploy.sh: only the publish window is exclusive, and the old whole-run rm is gone', () => {
  const s = readFileSync(join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');
  const at = (needle: string) => { const i = s.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };
  assert.doesNotMatch(s, /rm -f "\$DEPLOY_LOCK"/);
  assert.ok(at('deploy_lock_take') < at("trap 'deploy_lock_release"));
  assert.ok(at('deploy_step "release checks"') < at('deploy_lock_wait "$DEPLOY_ROWS_LOCK"'));
  assert.ok(at('deploy_lock_wait "$DEPLOY_ROWS_LOCK"') < at('node scripts/ci-trusted-checks.mjs "$revision" || true)   # waits'), 'the CI lookup runs after any wait');
  assert.ok(at('node scripts/release-checks.mjs') < at('deploy_lock_drop "$DEPLOY_ROWS_LOCK"'));
  assert.ok(at('deploy_lock_drop "$DEPLOY_ROWS_LOCK"') < at('deploy_lock_wait "$DEPLOY_PUBLISH_LOCK"'));
  assert.ok(at('deploy_lock_wait "$DEPLOY_PUBLISH_LOCK"') < at('deploy_publish_order "$live_now"'));
  assert.ok(at('deploy_publish_order "$live_now"') < at('deploy_step "transfer + switch"'));
  assert.match(s, /superseded\) echo "superseded: [^\n]*exit 3 ;;\n  \*\) echo "diverged: [^\n]*exit 3 ;;/, 'superseded and diverged both stop before the transfer');
  assert.match(s, /unknown\) echo "publish order: live unknown/, 'a publish without the guard is logged');
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

test('release-worktree: N+1 must be cut on every candidate in flight', () => {
  const { dir, env } = box();
  const { repo, n, n1, x } = history(dir);
  mkdirSync(env.DEPLOY_RUNS_DIR, { recursive: true });
  writeFileSync(join(env.DEPLOY_RUNS_DIR, `${process.pid}.json`), `{"revision":"${n}","started":"x","pid":${process.pid},"cwd":"/elsewhere"}\n`);   // N in flight
  writeFileSync(join(repo, 'package-lock.json'), '{}\n');
  const pick = (sha: string) => spawnSync('bash', [join(process.cwd(), 'scripts', 'release-worktree.sh'), sha], { cwd: repo, encoding: 'utf8',
    env: { ...env, RELEASE_SLOTS: join(dir, 'slot'), RELEASE_WORKTREE_INSTALL: 'true' } });
  const beside = pick(x);
  assert.equal(beside.status, 1);
  assert.match(beside.stderr, new RegExp(`${x} does not contain in-flight ${n} \\(pid ${process.pid}\\); cut N\\+1 on N's merge commit`));
  assert.ok(!existsSync(join(dir, 'slot')), 'refused before any checkout');
  assert.equal(pick(n1).status, 0, 'stacked on N: accepted');
});

test('publish-locked: the command runs under the publish lock, waits for a live release, and releases on exit', async () => {
  const { dir, env } = box();
  const script = join(process.cwd(), 'scripts', 'publish-locked.sh'), seen = join(dir, 'seen');
  mkdirSync(env.DEPLOY_PUBLISH_LOCK); writeFileSync(join(env.DEPLOY_PUBLISH_LOCK, 'pid'), `${process.pid}\n`);   // N is publishing
  const child = spawn('bash', [script, 'sh', '-c', `cat "$DEPLOY_PUBLISH_LOCK/pid" > '${seen}'`], { env: { ...env, DEPLOY_LOCK_WAIT_S: '60' } });
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.ok(!existsSync(seen), 'the writer reinstall waits for N to finish publishing');
  rmSync(env.DEPLOY_PUBLISH_LOCK, { recursive: true });
  assert.equal(await new Promise(resolve => child.on('exit', resolve)), 0);
  assert.equal(readFileSync(seen, 'utf8').trim(), String(child.pid), 'it ran holding the lock');
  assert.ok(!existsSync(env.DEPLOY_PUBLISH_LOCK), 'released on exit');
});
