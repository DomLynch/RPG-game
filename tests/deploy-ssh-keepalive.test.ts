// scripts/deploy.sh: a dead ssh path must fail fast (K6q11, 2026-10-21 17:38: the writer install finished on the box and the Mac's ssh client sat 12 min on a dead connection;
// the second time that day). Keepalives make the connection itself die in 15 s x 3 = 45 s; the install steps also run under net_bound with INSTALL_STEP_MAX_S (default 600 s).
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const deploy = readFileSync(join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');

test('the shared ssh options carry the keepalives (15 s x 3 = a dead connection fails in about 45 s)', () => {
  const line = deploy.split('\n').find(l => l.startsWith('ssh_options=')) ?? '';
  assert.match(line, /-o ServerAliveInterval=15 /);
  assert.match(line, /-o ServerAliveCountMax=3 /);
  assert.match(line, /-o ConnectTimeout=8 /);
});

test('the writer and presence install ssh calls run under net_bound with the step ceiling', () => {
  assert.match(deploy, /writer_install=\$\(net_bound "\$\{INSTALL_STEP_MAX_S:-600\}" "writer install ssh" ssh "\$\{ssh_options\[@\]\}"/);
  assert.match(deploy, /presence_install=\$\(net_bound "\$\{INSTALL_STEP_MAX_S:-600\}" "presence install ssh" ssh "\$\{ssh_options\[@\]\}"/);
  assert.equal(/^\s*(writer|presence)_install=\$\(ssh /m.test(deploy), false, 'no install ssh call is left unbounded');
});

test('a failed writer install puts the writer back before exiting (the install may have finished on the box while the client hung: writer ahead of the site)', () => {
  const branch = deploy.split('\n').find(l => l.includes('writer install failed for $revision')) ?? '';
  assert.match(branch, /writer_back; exit 1; \}/);
  const presence = deploy.split('\n').find(l => l.includes('presence install failed for $revision')) ?? '';
  assert.match(presence, /writer_back; presence_back; exit 1/, 'the presence branch still rolls both back');
});

test('a hung ssh is killed at the ceiling and named; the callee exit code is not swallowed', () => {
  const run = (cmd: string) => spawnSync('bash', ['-c', `source scripts/lib/net-bound.sh; ${cmd}; echo "rc=$?"`], { encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });
  const t0 = Date.now();
  const hung = run('net_bound 1 "writer install ssh" sleep 30');
  assert.match(hung.stdout, /rc=124/);
  assert.match(hung.stderr, /net-bound: writer install ssh timed out after 1s/);
  assert.ok(Date.now() - t0 < 10_000, 'it did not wait for the 30 s sleep');
  assert.match(run('net_bound 5 "x" bash -c "exit 7"').stdout, /rc=7/);
});
