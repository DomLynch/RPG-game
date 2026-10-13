// writer_back (deploy.sh): when the site switch fails after the writer install, the outgoing writer is put back, but ONLY while the site has not moved. An ssh drop after the
// switch ran (Auditor, #2489) used to roll the writer back behind a site already on the new release. writer_back_cmd builds the box-side command; run here against scratch roots
// with a stub systemctl.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function scene(siteAt: 'old' | 'new') {
  const root = mkdtempSync(join(tmpdir(), 'writer-back-'));
  const opt = join(root, 'opt'), site = join(root, 'site'), bin = join(root, 'bin'), calls = join(root, 'systemctl.log');
  for (const d of [join(opt, 'prev'), join(opt, 'next'), join(site, 'releases', 'old'), join(site, 'releases', 'new'), bin]) mkdirSync(d, { recursive: true });
  symlinkSync(join(opt, 'next'), join(opt, 'current'));   // the writer is on the NEW install
  symlinkSync(join(site, 'releases', siteAt), join(site, 'current'));
  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh\necho "$@" >> ${JSON.stringify(calls)}\n`); chmodSync(join(bin, 'systemctl'), 0o755);
  const run = () => spawnSync('bash', ['-c', `source scripts/lib/writer-parity.sh; eval "$(writer_back_cmd ${JSON.stringify(join(opt, 'prev'))} ${JSON.stringify(join(site, 'releases', 'new'))} ${JSON.stringify(opt)} ${JSON.stringify(site)})"`], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  return { root, opt, calls, run };
}

test('writer_back_cmd: the site did NOT move -> the writer is pointed back at the outgoing install and restarted', () => {
  const s = scene('old');
  try {
    const r = s.run();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readlinkSync(join(s.opt, 'current')), join(s.opt, 'prev'));
    assert.match(r.stdout, /writer put back on/);
    assert.ok(spawnSync('grep', ['-q', 'restart frankendom-origins-writer', s.calls]).status === 0, 'systemctl restart ran');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('writer_back_cmd: the site ALREADY moved to the new release (ssh dropped after the switch) -> the writer is left alone', () => {
  const s = scene('new');
  try {
    const r = s.run();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readlinkSync(join(s.opt, 'current')), join(s.opt, 'next'), 'still on the new install, in step with the site');
    assert.match(r.stdout, /NOT rolled back: the site already moved/);
    assert.notEqual(spawnSync('test', ['-e', s.calls]).status, 0, 'no restart');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});
