// ops/install-cpuweight.sh: the CPUWeight=1000 drop-ins for the three live services (Lead 2026-10-21: three Chromium -8 incidents, load 48). Run against a scratch root with a stub systemctl;
// the installer is for the Linux VPS (GNU install -D), so the script tests skip elsewhere. The point of the script is what it does NOT do: it never restarts a live unit.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repo = resolve(import.meta.dirname, '..');
const linux = process.platform === 'linux';
const conf = readFileSync(join(repo, 'ops/frankendom-cpuweight.conf'), 'utf8');
const UNITS = ['frankendom-origins-writer', 'frankendom-presence', 'frankendom-duel-relay'];

test('the drop-in sets exactly CPUWeight=1000 in [Service], and the installer never calls restart, stop or start', () => {
  assert.deepEqual(conf.split('\n').filter((l) => !l.startsWith('#') && l.trim()), ['[Service]', 'CPUWeight=1000']);
  const code = readFileSync(join(repo, 'ops/install-cpuweight.sh'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /systemctl\s+(restart|stop|start|try-restart|reload-or-restart|kill)/);
  assert.match(code, /systemctl daemon-reload/);
});

function scene() {
  const dir = mkdtempSync(join(tmpdir(), 'cpuweight-install-')), bin = join(dir, 'bin'), log = join(dir, 'calls.log');
  mkdirSync(bin);
  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh\necho "systemctl $@" >> ${JSON.stringify(log)}\n`); chmodSync(join(bin, 'systemctl'), 0o755);
  const run = (...args: string[]) => spawnSync('bash', [join(repo, 'ops/install-cpuweight.sh'), ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CPUWEIGHT_ROOT: join(dir, 'root') } });
  const dest = (u: string) => join(dir, 'root/etc/systemd/system', `${u}.service.d/10-cpuweight.conf`);
  return { dir, run, dest, calls: () => (existsSync(log) ? readFileSync(log, 'utf8') : ''), clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test('install: copies the drop-in for all three units and reloads once; a second run changes nothing and reloads nothing; a drifted file is put back; nothing is ever restarted', { skip: !linux }, () => {
  const s = scene();
  try {
    const first = s.run();
    assert.equal(first.status, 0, first.stderr);
    for (const u of UNITS) assert.equal(readFileSync(s.dest(u), 'utf8'), conf, u);
    assert.equal(s.calls().trim(), 'systemctl daemon-reload');
    const again = s.run();
    assert.equal(again.status, 0, again.stderr); assert.match(again.stdout, /nothing changed; no reload/);
    assert.equal(s.calls().trim(), 'systemctl daemon-reload', 'a second run reloads nothing');
    writeFileSync(s.dest('frankendom-presence'), '[Service]\nCPUWeight=100\n');
    assert.equal(s.run().status, 0);
    assert.equal(readFileSync(s.dest('frankendom-presence'), 'utf8'), conf);
    assert.equal(s.calls().trim().split('\n').length, 2, 'one more reload for the drift');
    assert.doesNotMatch(s.calls(), /restart|stop|start/);
  } finally { s.clean(); }
});

test('--remove takes the three drop-ins out and reloads once; with none present it is a no-op', { skip: !linux }, () => {
  const s = scene();
  try {
    assert.equal(s.run('--remove').status, 0); assert.equal(s.calls(), '', 'nothing present, no reload');
    s.run();
    const gone = s.run('--remove');
    assert.equal(gone.status, 0, gone.stderr);
    for (const u of UNITS) assert.equal(existsSync(s.dest(u)), false, u);
    assert.equal(s.calls().trim().split('\n').length, 2, 'install reload + remove reload');
  } finally { s.clean(); }
});
