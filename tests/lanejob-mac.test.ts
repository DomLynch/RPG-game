// scripts/lanejob/lanejob-mac.sh (Strategy + Dom 2026-10-12, the Mac middle tier, piece 3): a CPU-only job runs on the Mac only when the VPS probe
// says would=spill, load1 < 6 (twice), no deploy.sh runs, and the one Mac slot is free. Exit 75 = route it on. The probe, load, state dir and
// remote log are all stubbed (AGENTS.md: tests use tmp dirs, never live box state).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/lanejob/lanejob-mac.sh');

function box(answer = 'would=spill reason=slots') {
  const dir = mkdtempSync(join(tmpdir(), 'lanejob-mac-'));
  const probe = join(dir, 'probe.sh');
  writeFileSync(probe, `#!/bin/bash\necho '${answer}'\n`);
  chmodSync(probe, 0o755);
  const ran = join(dir, 'ran');
  const deployRe = `no-deploy-${dir.split('-').pop()}`;   // the real pgrep pattern would match a live deploy.sh or a sibling test's holder
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync('bash', [script, ...args], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, LANEJOB_MAC_STATE: dir, LANEJOB_MAC_PROBE: probe, LANEJOB_MAC_LOAD: '2.5', LANEJOB_MAC_RECHECK: '0', LANEJOB_MAC_NO_REMOTE_LOG: '1', LANEJOB_MAC_DEPLOY_RE: deployRe, LANEJOB_MAC_HOLD: join(dir, 'deploy_hold'), ...env },
  });
  return { dir, ran, run, deployRe, log: () => (existsSync(join(dir, 'lanejob-mac.log')) ? readFileSync(join(dir, 'lanejob-mac.log'), 'utf8') : '') };
}

test('would=spill with a quiet Mac runs the job, passes its exit code and logs tier=mac', () => {
  const b = box();
  const r = b.run(['bash', '-c', `touch ${b.ran}; exit 3`]);
  assert.equal(r.status, 3);
  assert.ok(existsSync(b.ran));
  assert.match(b.log(), /tier=mac slot=1 host=mac gpu=0 load=2\.5/);
  assert.match(r.stderr, /tier=mac slot=1 host=mac/);
  assert.ok(!existsSync(join(b.dir, 'lanejob-mac.slot')), 'the slot is released');
});

test('the VPS having room, a garbage probe answer or the off-switch send the job on (75) and run nothing', () => {
  for (const [answer, env, why] of [
    ['would=vps', {}, 'vps-has-room'], ['no idea', {}, 'probe-failed'], ['would=spill reason=slots', { LANEJOB_NO_MAC: '1' }, 'off-switch'],
  ] as const) {
    const b = box(answer);
    const r = b.run(['touch', b.ran], env);
    assert.equal(r.status, 75, why);
    assert.ok(!existsSync(b.ran), why);
    assert.match(b.log(), new RegExp(`tier=skip reason=${why}`));
  }
});

test('a loaded Mac (load1 >= 6) sends the job on', () => {
  const b = box();
  const r = b.run(['touch', b.ran], { LANEJOB_MAC_LOAD: '6.0' });
  assert.equal(r.status, 75);
  assert.ok(!existsSync(b.ran));
  assert.match(b.log(), /reason=load=6\.0/);
});

test('browser, full-suite, build and Blender jobs are refused (126) and the VPS probe refusing is passed on', () => {
  for (const cmd of [['npx', 'playwright', 'test'], ['npm', 'run', 'test:all'], ['npm', 'run', 'build'], ['blender', '-b']]) {
    assert.equal(box().run(cmd).status, 126, cmd.join(' '));
  }
  assert.equal(box('would=refuse').run(['true']).status, 126);
});

test('a live slot holder sends the job on; a dead holder is reclaimed', () => {
  const b = box();
  const slot = join(b.dir, 'lanejob-mac.slot');
  mkdirSync(slot);
  writeFileSync(join(slot, 'pid'), String(process.pid));
  assert.equal(b.run(['touch', b.ran]).status, 75);
  assert.match(b.log(), /reason=slot-busy/);
  writeFileSync(join(slot, 'pid'), '999999');
  assert.equal(b.run(['touch', b.ran]).status, 0);
  assert.ok(existsSync(b.ran));
});

test('a running deploy.sh sends the job on', () => {
  const b = box();
  const holder = spawn('bash', ['-c', 'sleep 30; :', b.deployRe], { stdio: 'ignore' });   // bash stays alive and its command line carries the tag
  spawnSync('sleep', ['0.3']);
  try {
    const r = b.run(['touch', b.ran]);
    assert.equal(r.status, 75);
    assert.match(b.log(), /reason=release-in-flight/);
  } finally { holder.kill(); }
});

test('the 30 minute cap kills the job and sends it on (75)', () => {
  const b = box();
  const r = b.run(['sleep', '30'], { LANEJOB_MAC_CAP: '1' });
  assert.equal(r.status, 75);
  assert.match(b.log(), /tier=mac cap=exceeded/);
});

test('Deploy\'s deploy_hold marker or a VPS release-lock answer sends the job on', () => {
  const b = box();
  writeFileSync(join(b.dir, 'deploy_hold'), '');
  assert.equal(b.run(['touch', b.ran]).status, 75);
  assert.match(b.log(), /reason=release-in-flight/);
  const c = box('would=spill reason=release-lock');
  assert.equal(c.run(['touch', c.ran]).status, 75);
  assert.ok(!existsSync(c.ran));
  assert.match(c.log(), /reason=release-in-flight/);
});

test('--gpu runs a trunk release row on the Mac FIRST (no VPS probe), with RELEASE_CHECK_CONCURRENCY=1 and PIT_GL unset', () => {
  const b = box('would=vps');   // the CPU-only form would send this on; --gpu ignores the probe
  const probeEnv = join(b.dir, 'envprobe.sh');
  writeFileSync(probeEnv, `#!/bin/bash\necho "c=$RELEASE_CHECK_CONCURRENCY pit=\${PIT_GL-unset}" > ${b.ran}\n`);
  const rows = join(b.dir, 'rows.txt');
  writeFileSync(rows, `bash ${probeEnv}\nnode scripts/other-check.mjs\n`);
  const r = b.run(['--gpu', '--', 'bash', probeEnv], { LANEJOB_MAC_ROWS: rows, PIT_GL: 'swiftshader' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(b.ran, 'utf8').trim(), 'c=1 pit=unset');
  assert.match(b.log(), /tier=mac slot=1 host=mac gpu=1/);
});

test('--gpu refuses anything that is not a listed row or a stills script (126) and malformed forms (2)', () => {
  const b = box();
  const rows = join(b.dir, 'rows.txt');
  writeFileSync(rows, 'node scripts/only-check.mjs\n');
  for (const cmd of [['npm', 'test'], ['node', 'scripts/only-check.mjs', '--extra'], ['npx', 'playwright', 'test'], ['node', 'scripts/x-stills.mjs', '../evil'], ['node', 'scripts/deploy-stillness.mjs'], ['node', 'scripts/x-stills.mjs', '/etc/passwd']]) {
    assert.equal(b.run(['--gpu', '--', ...cmd], { LANEJOB_MAC_ROWS: rows }).status, 126, cmd.join(' '));
  }
  assert.ok(!existsSync(b.ran));
  assert.equal(b.run(['--gpu', 'node', 'scripts/a-still.mjs']).status, 2);   // no `--`
  assert.equal(b.run(['--gpu', '--']).status, 2);
});

test('--gpu is skipped while a Mac release row or WebKit run is active, at load >= 6, or with the off-switch', () => {
  const b = box();
  const rows = join(b.dir, 'rows.txt');
  writeFileSync(rows, 'touch ' + b.ran + '\n');
  const tag = `mac-row-${b.dir.split('-').pop()}`;
  const holder = spawn('bash', ['-c', 'sleep 30; :', tag], { stdio: 'ignore' });
  spawnSync('sleep', ['0.3']);
  try {
    const r = b.run(['--gpu', '--', 'touch', b.ran], { LANEJOB_MAC_ROWS: rows, LANEJOB_MAC_ROWS_RE: tag });
    assert.equal(r.status, 75);
    assert.match(b.log(), /reason=mac-row-running/);
  } finally { holder.kill(); }
  assert.equal(b.run(['--gpu', '--', 'touch', b.ran], { LANEJOB_MAC_ROWS: rows, LANEJOB_MAC_LOAD: '7' }).status, 75);
  assert.equal(b.run(['--gpu', '--', 'touch', b.ran], { LANEJOB_MAC_ROWS: rows, LANEJOB_NO_MAC: '1' }).status, 75);
  assert.ok(!existsSync(b.ran));
});

test('the load gate reads the 5-MINUTE average: a 1-minute spike does not skip the Mac, a busy 5-minute average does', () => {
  const b = box();
  const bin = join(b.dir, 'bin');
  mkdirSync(bin);
  const uptime = (a: string) => { writeFileSync(join(bin, 'uptime'), `#!/bin/bash\necho "10:00  up 1 day, load averages: ${a}"\n`); chmodSync(join(bin, 'uptime'), 0o755); };
  const env = { LANEJOB_MAC_LOAD: '', PATH: `${bin}:${process.env.PATH}` };
  uptime('9.00 2.00 2.00');   // spike now, quiet 5-minute average
  assert.equal(b.run(['touch', b.ran], env).status, 0);
  uptime('1.00 7.00 7.00');   // quiet now, busy 5-minute average
  const r = b.run(['touch', join(b.dir, 'ran2')], env);
  assert.equal(r.status, 75);
  assert.match(b.log(), /reason=load=7\.00/);
});
