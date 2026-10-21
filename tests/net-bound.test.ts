// scripts/lib/net-bound.sh: every network call the release train and deploy.sh make is bounded. A hung git/gh (2026-10-15/16: a
// `git fetch` sat 73 min, a `git push` 61 min, a `gh run view` 21 min, all inside the launchd train) is killed at its limit with its whole
// process group, named "<tool> <op> timed out after Ns", exit 124; a call that finishes in time is untouched and git gets low-speed limits.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lib = join(process.cwd(), 'scripts', 'lib', 'net-bound.sh');
// A stub tool on PATH. `hang` leaves ONE grandchild (under sh, the way git runs git-remote-https) that writes a marker after 30 s and
// holds the stdout pipe: a kill that reached only the direct child would leave it running and spawnSync waiting. Marker absent on return
// = the whole group was killed. A kill that missed makes the test slow (30 s) and red, never green (same ORDER-not-wall-clock rule as
// tests/deploy-ceiling.test.ts).
const stub = (tool: 'git' | 'gh', mode: 'hang' | 'ok') => {
  const dir = mkdtempSync(join(tmpdir(), 'net-bound-')), bin = join(dir, 'bin'), marker = join(dir, 'finished');
  mkdirSync(bin);
  const body = mode === 'hang'
    ? `sh -c "'${process.execPath}' -e 'setTimeout(() => require(\\"node:fs\\").writeFileSync(\\"${marker}\\", \\"\\"), 30_000)'; exit"`
    : 'echo "ARGS:$* LS:$GIT_CONFIG_VALUE_0/$GIT_CONFIG_VALUE_1 N:$GIT_CONFIG_COUNT"';
  writeFileSync(join(bin, tool), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, tool), 0o755);
  return { marker, run: (script: string) => spawnSync('bash', ['-c', `source '${lib}'\n${script}`], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }) };
};

test('a hung git fetch is killed at its limit with the whole group, named, exit 124', () => {
  const s = stub('git', 'hang');
  const r = s.run('net_git 1 fetch -q origin; rc=$?; echo "rc=$rc why=$NET_WHY"; exit $rc');
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.match(r.stderr, /net-bound: git fetch timed out after 1s/);
  assert.match(r.stdout, /rc=124 why=git fetch timed out after 1s/);
  assert.ok(!existsSync(s.marker), 'the hung grandchild was killed, not waited out');
});
test('a hung gh call is killed at its limit and named with its two-word op', () => {
  const s = stub('gh', 'hang');
  const r = s.run('net_gh 1 run view 123 --json jobs; exit $?');
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.match(r.stderr, /net-bound: gh run view timed out after 1s/);
  assert.ok(!existsSync(s.marker), 'the hung grandchild was killed, not waited out');
});
test('a call that finishes in time passes its output and exit through; git carries the low-speed limits and no prompts', () => {
  const g = stub('git', 'ok').run('net_git 30 ls-remote origin refs/heads/x; echo "rc=$? why=[$NET_WHY]"');
  assert.match(g.stdout, /ARGS:ls-remote origin refs\/heads\/x LS:1000\/60 N:2/, 'the command line stays `git <op> args`; the limits ride in the environment');
  assert.match(g.stdout, /rc=0 why=\[\]/);
  const h = stub('gh', 'ok').run('net_gh 30 pr view 7; echo "rc=$?"');
  assert.match(h.stdout, /ARGS:pr view 7 LS:\/ N:\nrc=0/);
});
// net_fetch_local_first (Strategy 2026-10-21, the box's 14:15 to 14:32 outbound outage): stub git (cat-file answers HAVE, fetch is logged) and stub curl (fails its first FAIL calls).
const fetchWorld = (have: boolean, curlFails: number) => {
  const dir = mkdtempSync(join(tmpdir(), 'net-fetch-')), bin = join(dir, 'bin'), log = join(dir, 'calls'), repo = join(dir, 'repo'); mkdirSync(bin); mkdirSync(repo);
  writeFileSync(join(bin, 'git'), `#!/bin/sh\ncase "$*" in *cat-file*) exit ${have ? 0 : 1};; *fetch*) echo fetch >> '${log}'; exit 0;; esac\nexit 0\n`);
  writeFileSync(join(bin, 'curl'), `#!/bin/sh\necho curl >> '${log}'\nn=$(grep -c curl '${log}')\n[ "$n" -le ${curlFails} ] && exit 7\nexit 0\n`);
  chmodSync(join(bin, 'git'), 0o755); chmodSync(join(bin, 'curl'), 0o755);
  const run = (script: string) => spawnSync('bash', ['-c', `source '${lib}'\nexport NET_RETRY_SLEEP=0 NET_CONNECT_S=1\n${script.replaceAll('/repo', repo)}`], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);
  return { run, calls };
};
test('net_fetch_local_first: a commit already in the local store never touches the network', () => {
  const w = fetchWorld(true, 99), r = w.run('net_fetch_local_first /repo abc123; echo "rc=$?"');
  assert.match(r.stdout, /rc=0/); assert.deepEqual(w.calls(), [], 'no curl probe, no fetch');
});
test('net_fetch_local_first: GitHub unreachable on all 3 attempts is a named failure with exit 1 and no fetch', () => {
  const w = fetchWorld(false, 99), r = w.run('net_fetch_local_first /repo abc123; echo "rc=$? why=[$NET_WHY]"');
  assert.match(r.stdout, /rc=1 why=\[github\.com unreachable \(no connection in 1s, attempt 3 of 3\)\]/);
  assert.deepEqual(w.calls(), ['curl', 'curl', 'curl'], 'three probes, git fetch never started');
  assert.match(r.stderr, /net-bound: github\.com unreachable/);
});
test('net_fetch_local_first: a blip that clears on the 2nd attempt fetches once and succeeds', () => {
  const w = fetchWorld(false, 1), r = w.run('net_fetch_local_first /repo abc123; echo "rc=$? why=[$NET_WHY]"');
  assert.match(r.stdout, /rc=0 why=\[\]/); assert.deepEqual(w.calls(), ['curl', 'curl', 'fetch']);
});
test('net_fetch_local_first: an empty sha has no local shortcut (the plain fetch of every ref)', () => {
  const w = fetchWorld(true, 0), r = w.run('net_fetch_local_first /repo ""; echo "rc=$?"');
  assert.match(r.stdout, /rc=0/); assert.deepEqual(w.calls(), ['curl', 'fetch']);
});
test('net_retry: the last failure code passes through after N tries; an early success stops it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'net-retry-')), n = join(dir, 'n');
  const r = spawnSync('bash', ['-c', `source '${lib}'\nexport NET_RETRY_SLEEP=0\ntry(){ echo x >> '${n}'; return 7; }\nnet_retry 3 try; echo "rc=$?"; wc -l < '${n}'\nok(){ return 0; }\nnet_retry 3 ok; echo "rc=$?"`], { encoding: 'utf8' });
  assert.match(r.stdout, /rc=7\s+3\s+rc=0/);
});
test('the VPS job runners reach GitHub only through the bounded, local-first paths', () => {
  const unit = readFileSync('scripts/vps-shadow/run-unit.sh', 'utf8'), rows = readFileSync('scripts/vps-shadow/run-rows.sh', 'utf8'), vu = readFileSync('scripts/lib/vps-unit.mjs', 'utf8'), vr = readFileSync('scripts/lib/vps-receipts.mjs', 'utf8');
  for (const s of [unit, rows]) { assert.match(s, /net_fetch_local_first "\$home\/repo" "\$sha"/); assert.doesNotMatch(s, /^git fetch -q origin$|; git fetch -q origin;/m, 'no unbounded fetch left'); }
  assert.match(vu, /cat-file -e '\$\{sha\}\^\{commit\}'/, 'vps-unit: local store first'); assert.match(vu, /--connect-timeout 30 --max-time 45 https:\/\/github\.com/);
  assert.match(vu, /curl -fsSL --connect-timeout 30 --retry 3/, 'the node tarball curl is bounded and retried');
  assert.doesNotMatch(vr, /timeout 300 git fetch/); assert.equal((vr.match(/for i in 1 2 3; do timeout 120 git fetch -q origin/g) ?? []).length, 2, 'both container job commands retry the fetch');
});
test('the callee\'s own failure code survives; its own 124 is not mistaken for a timeout', () => {
  const s = stub('git', 'ok');
  const fail = s.run('net_bound 30 "git x" sh -c "exit 3"; echo "rc=$? why=[$NET_WHY]"');
  assert.match(fail.stdout, /rc=3 why=\[\]/);
  const own124 = s.run('net_bound 30 "git x" sh -c "exit 124"; echo "rc=$? why=[$NET_WHY]"');
  assert.match(own124.stdout, /rc=123 why=\[\]/, 'a callee that exits 124 itself is reported as 123, so 124 means only "timed out"');
});
