// ops/install-journald.sh: Frankendom's persistent-journal drop-in (2026-10-13: the journal sat at its 500M cap and rotated every ~3 days, so the 102 presence restarts could not be explained).
// Run against a scratch root with a stub systemctl; the installer is for the Linux VPS (GNU install -D), so the script tests skip elsewhere.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repo = resolve(import.meta.dirname, '..');
const linux = process.platform === 'linux';
const conf = readFileSync(join(repo, 'ops/journald-frankendom.conf'), 'utf8');

test('the drop-in pins persistent storage and a 1G cap, keeps 30 days, and sorts after the other projects\' drop-ins', () => {
  const body = conf.split('\n').filter(l => !l.startsWith('#') && l.trim());
  assert.deepEqual(body, ['[Journal]', 'Storage=persistent', 'SystemMaxUse=1G', 'SystemMaxFileSize=128M', 'MaxRetentionSec=30day']);
  const install = readFileSync(join(repo, 'ops/install-journald.sh'), 'utf8');
  assert.match(install, /journald\.conf\.d\/zz-frankendom\.conf/);
  assert.ok('zz-frankendom.conf' > 'size.conf' && 'zz-frankendom.conf' > 'elite-trader.conf', 'systemd reads drop-ins in lexical order: the last value wins');
  assert.doesNotMatch(install.split('\n').filter(l => !l.trim().startsWith('#')).join('\n'), /elite-trader|size\.conf/, 'its code never touches the other projects\' files');
});

function scene() {
  const dir = mkdtempSync(join(tmpdir(), 'journald-install-')), bin = join(dir, 'bin'), log = join(dir, 'calls.log');
  mkdirSync(bin);
  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh\necho "systemctl $@" >> ${JSON.stringify(log)}\n`); chmodSync(join(bin, 'systemctl'), 0o755);
  const run = (...args: string[]) => spawnSync('bash', [join(repo, 'ops/install-journald.sh'), ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, JOURNALD_ROOT: join(dir, 'root') } });
  return { dir, run, dest: join(dir, 'root/etc/systemd/journald.conf.d/zz-frankendom.conf'), calls: () => (existsSync(log) ? readFileSync(log, 'utf8') : ''), clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test('install: writes the drop-in and restarts journald once; a second run changes nothing and restarts nothing; a drifted file is put back', { skip: !linux }, () => {
  const s = scene();
  try {
    const first = s.run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(readFileSync(s.dest, 'utf8'), conf);
    assert.equal(s.calls().trim(), 'systemctl restart systemd-journald');
    const again = s.run();
    assert.equal(again.status, 0);
    assert.match(again.stdout, /already current; journald not restarted/);
    assert.equal(s.calls().trim().split('\n').length, 1, 'no second restart');
    writeFileSync(s.dest, '[Journal]\nSystemMaxUse=10M\n');
    assert.equal(s.run().status, 0);
    assert.equal(readFileSync(s.dest, 'utf8'), conf, 'the drifted file is replaced');
    assert.equal(s.calls().trim().split('\n').length, 2, 'and journald restarted once more');
  } finally { s.clean(); }
});

test('--remove: deletes the drop-in and restarts journald; with no drop-in it does nothing', { skip: !linux }, () => {
  const s = scene();
  try {
    assert.match(s.run('--remove').stdout, /nothing to remove/);
    assert.equal(s.calls(), '');
    s.run();
    const r = s.run('--remove');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!existsSync(s.dest), 'removed');
    assert.equal(s.calls().trim().split('\n').length, 2);
  } finally { s.clean(); }
});
