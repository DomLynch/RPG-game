// scripts/hfjob/hfguard.sh (Strategy + Dom 2026-10-29): suites/builds do not run on the VPS; npm/npx/blender/playwright are symlinks to this guard. Everything here uses stub binaries and a stub hfjob
// in tmp dirs: no network, no HF call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/hfjob/hfguard.sh');

function box() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'hfguard-'))), real = join(dir, 'real'), bin = join(dir, 'bin'), work = join(dir, 'work');
  for (const d of [real, bin, work]) mkdirSync(d);
  for (const n of ['npm', 'npx', 'blender', 'playwright']) {
    writeFileSync(join(real, n), `#!/bin/sh\necho "REAL ${n} $*" >> "${dir}/ran"\n`); chmodSync(join(real, n), 0o755);
    symlinkSync(script, join(bin, n));
  }
  const hfjob = (ok: boolean) => { const p = join(dir, ok ? 'hfjob-ok' : 'hfjob-fail'); writeFileSync(p, ok ? `#!/bin/sh\necho "args:$*" >> "${dir}/hfjob-args"\necho "tier=hf-cpu job=aaaaaaaaaaaaaaaaaaaaaaaa repo=x/y sha=abc"\n` : '#!/bin/sh\necho "hfjob: hf jobs run failed (rc=1): no token for this user" >&2; exit 1\n'); chmodSync(p, 0o755); return p; };
  const run = (name: string, args: string[], env: NodeJS.ProcessEnv = {}) => spawnSync(join(bin, name), args, {
    cwd: work, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HFGUARD_REAL_DIR: real, HFGUARD_DIRS: dir, HFGUARD_LOG: join(dir, 'log'), HFGUARD_HFJOB: hfjob(true), HFGUARD_LOAD: '1', ...env },
  });
  const ran = () => (existsSync(join(dir, 'ran')) ? readFileSync(join(dir, 'ran'), 'utf8') : '');
  const log = () => (existsSync(join(dir, 'log')) ? readFileSync(join(dir, 'log'), 'utf8') : '');
  return { dir, run, ran, log, hfjob, args: () => (existsSync(join(dir, 'hfjob-args')) ? readFileSync(join(dir, 'hfjob-args'), 'utf8') : ''), done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('heavy commands in a lane work area are re-launched through hfjob and exit 75 with a not-run-here banner', () => {
  const b = box();
  try {
    for (const [name, args] of [['npm', ['test']], ['npm', ['run', 'test:all']], ['npm', ['run', 'build']], ['npm', ['run', 'quality:fast']], ['npx', ['playwright', 'test']], ['npx', ['vite', 'build']], ['blender', ['-b', 'x.blend']], ['playwright', ['test']]] as const) {
      const r = b.run(name, [...args]);
      assert.equal(r.status, 75, `${name} ${args.join(' ')}: ${r.stderr}`);
      assert.match(r.stdout, /tier=hf-cpu job=a{24}/);
      assert.match(r.stderr, /NOT run on this box.*not a pass/);
    }
    assert.equal(b.ran(), '', 'the real binaries never ran');
    assert.match(b.args(), /args:-- npm test\n/);
    assert.match(b.log(), /event=spilled cmd=npm test/);
  } finally { b.done(); }
});

test('light commands and anything outside the lane work areas run the real binary untouched', () => {
  const b = box();
  try {
    for (const [name, args] of [['npm', ['ci']], ['npm', ['view', 'x']], ['npm', ['run', 'lint']], ['npx', ['tsc', '--version']], ['playwright', ['install']]] as const) {
      assert.equal(b.run(name, [...args]).status, 0, `${name} ${args.join(' ')}`);
    }
    assert.equal(b.ran().trim().split('\n').length, 5);
    const outside = b.run('npm', ['test'], { HFGUARD_DIRS: '/nonexistent-area' });   // live-site dirs: not a lane work area
    assert.equal(outside.status, 0);
    assert.match(b.ran(), /REAL npm test/);
  } finally { b.done(); }
});

test('HFGUARD_OK=1 runs the real binary and logs the bypass', () => {
  const b = box();
  try {
    const r = b.run('npm', ['run', 'build'], { HFGUARD_OK: '1' });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /HFGUARD_OK=1/);
    assert.match(b.log(), /event=bypass cmd=npm run build/);
    assert.match(b.ran(), /REAL npm run build/);
  } finally { b.done(); }
});

test('a failed spill is loud: refused above the load limit, run locally with a banner below it, always logged with the reason', () => {
  const b = box();
  try {
    const high = b.run('npm', ['test'], { HFGUARD_HFJOB: b.hfjob(false), HFGUARD_LOAD: '63.9' });
    assert.equal(high.status, 2);
    assert.match(high.stderr, /FAILED TO SPILL 'npm test'.*no token for this user/);
    assert.match(high.stderr, /refusing to run it here: load 63 is over 20/);
    assert.equal(b.ran(), '');
    const low = b.run('npm', ['test'], { HFGUARD_HFJOB: b.hfjob(false), HFGUARD_LOAD: '2.5' });
    assert.equal(low.status, 0);
    assert.match(low.stderr, /FAILED TO SPILL/);
    assert.match(low.stderr, /running it locally this once/);
    assert.match(b.ran(), /REAL npm test/);
    assert.match(b.log(), /event=FAILED-TO-SPILL load=63 reason=hfjob: hf jobs run failed \(rc=1\): no token for this user/);
  } finally { b.done(); }
});

test('the installer parses and the script refuses an unknown name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfguard-x-'));
  try {
    assert.equal(spawnSync('bash', ['-n', script]).status, 0);
    assert.equal(spawnSync('sh', ['-n', join(process.cwd(), 'scripts/hfjob/install-hfguard.sh')]).status, 0);
    symlinkSync(script, join(dir, 'cargo'));
    const r = spawnSync(join(dir, 'cargo'), [], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /link it as npm, npx, blender or playwright/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
