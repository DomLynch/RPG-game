// scripts/hfjob/inner-bundle.sh: the job installs the pinned official Blender 5.2.1 tarball (sha256-checked, mirrors in order, apt last) when the command mentions blender.
// The install block runs here with a stub curl/apt-get and a fixture tarball: no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const inner = readFileSync(join(process.cwd(), 'scripts/hfjob/inner-bundle.sh'), 'utf8');
const block = /# BEGIN blender5[^\n]*\n([\s\S]*?)# END blender5/.exec(inner)![1];
const hasXz = spawnSync('xz', ['--version']).status === 0;

test('the pin: version 5.2.1, a 64-hex sha256, three mirrors with download.blender.org last, apt only as the fallback', () => {
  assert.match(block, /BLENDER_VER=\$\{BLENDER_VER:-5\.2\.1\}/);
  assert.match(block, /BLENDER_SHA256=\$\{BLENDER_SHA256:-[0-9a-f]{64}\}/);
  const m = /BLENDER_MIRRORS=\$\{BLENDER_MIRRORS:-"([^"]+)"\}/.exec(block)![1].split(' ');
  assert.equal(m.length, 3); assert.match(m[0], /mirrors\.ocf\.berkeley\.edu/); assert.match(m[2], /^https:\/\/download\.blender\.org\//);
  assert.ok(block.indexOf('install_blender5; then') < block.indexOf('apt-get install -y -qq blender'), 'apt comes after the tarball attempt');
  assert.match(block, /\*blender\*\)/, 'only commands that mention blender install it');
});

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'hfb5-')), bin = join(dir, 'bin'), root = join(dir, 'root');
  mkdirSync(bin); mkdirSync(join(dir, 'fx'));
  // fixture tarball: a top-level folder with a fake `blender`
  const src = join(dir, 'blender-5.2.1-linux-x64'); mkdirSync(src);
  writeFileSync(join(src, 'blender'), '#!/bin/sh\necho "Blender 5.2.1 LTS"\n'); chmodSync(join(src, 'blender'), 0o755);
  const good = join(dir, 'fx/good.tar.xz'); execFileSync('tar', ['-cJf', good, '-C', dir, 'blender-5.2.1-linux-x64']);
  writeFileSync(join(dir, 'fx/bad.tar.xz'), 'not the tarball');
  // stub curl: serves fx/<name> where name is chosen per mirror by STUB_MAP ("host=good,host2=bad,host3=fail"); logs every URL
  writeFileSync(join(bin, 'curl'), `#!/bin/bash
out=""; url=""; while [ $# -gt 0 ]; do case "$1" in -o) out=$2; shift 2 ;; -A) shift 2 ;; --retry) shift 2 ;; -*) shift ;; *) url=$1; shift ;; esac; done
echo "$url" >> "$STUB_LOG"
host=\${url#https://}; host=\${host%%/*}
for kv in \${STUB_MAP//,/ }; do [ "\${kv%%=*}" = "$host" ] && what=\${kv#*=}; done
[ "\${what:-fail}" = fail ] && exit 22
cp "$STUB_FX/$what.tar.xz" "$out"
`); chmodSync(join(bin, 'curl'), 0o755);
  writeFileSync(join(bin, 'apt-get'), '#!/bin/sh\necho "$@" >> "$STUB_LOG"\nexit 0\n'); chmodSync(join(bin, 'apt-get'), 0o755);
  const sha = createHash('sha256').update(readFileSync(good)).digest('hex');
  const run = (map: string) => {
    const log = join(dir, 'calls.log'); rmSync(log, { force: true });
    const r = spawnSync('bash', ['-c', `cmd=true; lap(){ :; }\n${block}\ninstall_blender5; echo "rc=$?"`], {
      encoding: 'utf8', timeout: 30000,
      env: { PATH: `${bin}:${process.env.PATH}`, STUB_LOG: log, STUB_FX: join(dir, 'fx'), STUB_MAP: map, BLENDER_SHA256: sha, BLENDER_ROOT: root, BLENDER_LINK: join(dir, 'blender-link') } });
    const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
    return { r, calls };
  };
  return { dir, root, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('install: first good mirror wins, the tarball is verified and extracted, `blender --version` runs; later mirrors are not touched', { skip: !hasXz && 'no xz' }, () => {
  const s = sandbox();
  try {
    const { r, calls } = s.run('mirrors.ocf.berkeley.edu=good,ftp.nluug.nl=good,download.blender.org=good');
    assert.match(r.stdout, /rc=0/, r.stderr);
    assert.equal(calls.filter((c) => c.startsWith('https://')).length, 1);
    assert.ok(existsSync(join(s.root, 'blender')));
    assert.equal(execFileSync(join(s.dir, 'blender-link'), ['--version'], { encoding: 'utf8' }).trim(), 'Blender 5.2.1 LTS');
  } finally { s.done(); }
});

test('mirror order: a failing mirror, then one serving the wrong bytes (sha mismatch), then the good one; the bad bytes are never extracted', { skip: !hasXz && 'no xz' }, () => {
  const s = sandbox();
  try {
    const { r, calls } = s.run('mirrors.ocf.berkeley.edu=fail,ftp.nluug.nl=bad,download.blender.org=good');
    assert.match(r.stdout, /rc=0/, r.stderr);
    assert.deepEqual(calls.filter((c) => c.startsWith('https://')).map((c) => c.split('/')[2]), ['mirrors.ocf.berkeley.edu', 'ftp.nluug.nl', 'download.blender.org']);
    assert.match(r.stderr, /mirror failed: mirrors\.ocf/); assert.match(r.stderr, /sha256 mismatch from ftp\.nluug\.nl/);
  } finally { s.done(); }
});

test('no mirror gives the pinned bytes: install_blender5 fails (the job then falls back to apt) and nothing is extracted', { skip: !hasXz && 'no xz' }, () => {
  const s = sandbox();
  try {
    const { r } = s.run('mirrors.ocf.berkeley.edu=bad,ftp.nluug.nl=fail,download.blender.org=bad');
    assert.match(r.stdout, /rc=1/);
    assert.ok(!existsSync(join(s.root, 'blender')));
  } finally { s.done(); }
});
