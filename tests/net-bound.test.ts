// scripts/lib/net-bound.sh: every network call the release train and deploy.sh make is bounded. A hung git/gh (2026-10-15/16: a
// `git fetch` sat 73 min, a `git push` 61 min, a `gh run view` 21 min, all inside the launchd train) is killed at its limit with its whole
// process group, named "<tool> <op> timed out after Ns", exit 124; a call that finishes in time is untouched and git gets low-speed limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
test('the callee\'s own failure code survives; its own 124 is not mistaken for a timeout', () => {
  const s = stub('git', 'ok');
  const fail = s.run('net_bound 30 "git x" sh -c "exit 3"; echo "rc=$? why=[$NET_WHY]"');
  assert.match(fail.stdout, /rc=3 why=\[\]/);
  const own124 = s.run('net_bound 30 "git x" sh -c "exit 124"; echo "rc=$? why=[$NET_WHY]"');
  assert.match(own124.stdout, /rc=123 why=\[\]/, 'a callee that exits 124 itself is reported as 123, so 124 means only "timed out"');
});
