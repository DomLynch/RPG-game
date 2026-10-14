// scripts/lanejob/lanejob-mac.sh (Dom 2026-10-12, Strategy defect 3): the Mac is tried FIRST (no VPS probe), for a CPU-only job, when the 5-minute load
// average < 8, no release is in flight, the job is not on the deny list and the one Mac slot is free. Exit 75 = route it on (VPS, then hf-cpu).
// --probe says would=mac / would=skip reason=... without running anything. Load, state dir and remote log are stubbed (AGENTS.md: tests use tmp dirs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/lanejob/lanejob-mac.sh');

function box() {
  const dir = mkdtempSync(join(tmpdir(), 'lanejob-mac-'));
  const ran = join(dir, 'ran');
  const ssh = join(dir, 'ssh-stub.sh'), sshLog = join(dir, 'ssh.log');   // tests never ssh the live VPS (AGENTS.md): every ssh call lands here
  writeFileSync(ssh, `#!/bin/bash\necho "$*" >> ${sshLog}\n`);
  chmodSync(ssh, 0o755);
  const deployRe = `no-deploy-${dir.split('-').pop()}`;   // the real pgrep pattern would match a live deploy.sh or a sibling test's holder
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync('bash', [script, ...args], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, LANEJOB_MAC_STATE: dir, LANEJOB_MAC_SSH: ssh, LANEJOB_MAC_LOAD: '2.5', LANEJOB_MAC_RECHECK: '0', LANEJOB_MAC_NO_REMOTE_LOG: '1', LANEJOB_MAC_DEPLOY_RE: deployRe, LANEJOB_MAC_HOLD: join(dir, 'deploy_hold'), LANEJOB_MAC_ROWS_RE: `no-row-${dir.split('-').pop()}`, ...env },
  });
  return { dir, ran, run, deployRe, ssh, sshLog, log: () => (existsSync(join(dir, 'lanejob-mac.log')) ? readFileSync(join(dir, 'lanejob-mac.log'), 'utf8') : '') };
}

test('a quiet Mac runs the job FIRST, passes its exit code and logs tier=mac', () => {
  const b = box();
  const r = b.run(['bash', '-c', `touch ${b.ran}; exit 3`]);
  assert.equal(r.status, 3);
  assert.ok(existsSync(b.ran));
  assert.match(b.log(), /tier=mac slot=1 host=mac gpu=0 load=2\.5/);
  assert.match(r.stderr, /tier=mac slot=1 host=mac/);
  assert.ok(!existsSync(join(b.dir, 'lanejob-mac.slot')), 'the slot is released');
});

test('the off-switch and a denied job send the job on (75) and run nothing; browser, full-suite, build and Blender are all denied', () => {
  const b = box();
  const r = b.run(['touch', b.ran], { LANEJOB_NO_MAC: '1' });
  assert.equal(r.status, 75);
  assert.ok(!existsSync(b.ran));
  assert.match(b.log(), /tier=skip reason=off-switch/);
  for (const cmd of [['npx', 'playwright', 'test'], ['npm', 'run', 'test:all'], ['npm', 'run', 'build'], ['blender', '-b'], ['npm', 'run', 'quality']]) {
    const c = box();
    assert.equal(c.run(cmd).status, 75, cmd.join(' '));
    assert.match(c.log(), /tier=skip reason=denied/, cmd.join(' '));
  }
});

test('the Mac never asks the VPS probe: no ssh call carries --probe, and the box never reaches the live VPS', () => {
  const b = box();
  const r = b.run(['true'], { LANEJOB_MAC_NO_REMOTE_LOG: '' });   // lets released() and note() use the (stubbed) ssh
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(b.sshLog), 'the stub, not a real ssh, took the call');
  assert.ok(!/--probe/.test(readFileSync(b.sshLog, 'utf8')));
});

test('a loaded Mac (5-minute load >= 8) sends the job on; 7.9 still runs it (Dom raised the gate from 6 to 8)', () => {
  const b = box();
  assert.equal(b.run(['touch', b.ran], { LANEJOB_MAC_LOAD: '7.9' }).status, 0);
  assert.ok(existsSync(b.ran));
  const c = box();
  const r = c.run(['touch', c.ran], { LANEJOB_MAC_LOAD: '8.0' });
  assert.equal(r.status, 75);
  assert.ok(!existsSync(c.ran));
  assert.match(c.log(), /reason=load=8\.0/);
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

test('Deploy\'s deploy_hold marker sends the job on', () => {
  const b = box();
  writeFileSync(join(b.dir, 'deploy_hold'), '');
  assert.equal(b.run(['touch', b.ran]).status, 75);
  assert.ok(!existsSync(b.ran));
  assert.match(b.log(), /reason=release-in-flight/);
});

test('--gpu runs a trunk release row on the Mac with RELEASE_CHECK_CONCURRENCY=1 and PIT_GL unset', () => {
  const b = box();
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
  writeFileSync(rows, 'node scripts/only-check.mjs\nnode scripts/only-check.mjs --engine webkit\n');
  for (const cmd of [['npm', 'test'], ['node', 'scripts/only-check.mjs', '--extra'], ['npx', 'playwright', 'test'], ['node', 'scripts/x-stills.mjs', '../evil'], ['node', 'scripts/deploy-stillness.mjs'], ['node', 'scripts/only-check.mjs', '--engine', 'webkit'], ['node', 'scripts/x-stills.mjs', '/etc/passwd']]) {
    assert.equal(b.run(['--gpu', '--', ...cmd], { LANEJOB_MAC_ROWS: rows }).status, 126, cmd.join(' '));
  }
  assert.ok(!existsSync(b.ran));
  assert.equal(b.run(['--gpu', 'node', 'scripts/a-still.mjs']).status, 2);   // no `--`
  assert.equal(b.run(['--gpu', '--']).status, 2);
});

test('--gpu is skipped while a Mac release row or WebKit run is active, at load >= 8, or with the off-switch', () => {
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
  assert.equal(b.run(['--gpu', '--', 'touch', b.ran], { LANEJOB_MAC_ROWS: rows, LANEJOB_MAC_LOAD: '9' }).status, 75);
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
  uptime('1.00 9.00 9.00');   // quiet now, busy 5-minute average
  const r = b.run(['touch', join(b.dir, 'ran2')], env);
  assert.equal(r.status, 75);
  assert.match(b.log(), /reason=load=9\.00/);
});

test('a finished job is never called capped, even when many jobs end at once (the dog\'s sleep is killed on exit)', () => {
  for (let i = 0; i < 25; i++) {
    const b = box();
    const r = b.run(['bash', '-c', 'exit 3']);
    assert.equal(r.status, 3, `run ${i}: ${r.stderr}\n${b.log()}`);
    assert.ok(!/cap=exceeded/.test(b.log()), `run ${i}`);
  }
});

test('--probe predicts the run: would=mac when it would run, would=skip reason=... otherwise, and it runs nothing, takes no slot, writes no log', () => {
  const b = box();
  assert.equal(b.run(['--probe', 'touch', b.ran]).stdout.trim(), 'would=mac');
  assert.equal(b.run(['--probe', 'touch', b.ran], { LANEJOB_MAC_LOAD: '8' }).stdout.trim(), 'would=skip reason=load=8');
  assert.equal(b.run(['--probe', 'touch', b.ran], { LANEJOB_NO_MAC: '1' }).stdout.trim(), 'would=skip reason=off-switch');
  assert.equal(b.run(['--probe', 'npm', 'run', 'test:all']).stdout.trim(), 'would=skip reason=denied');
  writeFileSync(join(b.dir, 'deploy_hold'), '');
  assert.equal(b.run(['--probe', 'true']).stdout.trim(), 'would=skip reason=release-in-flight');
  assert.ok(!existsSync(b.ran));
  assert.equal(b.log(), '');
  assert.ok(!existsSync(join(b.dir, 'lanejob-mac.slot')));
});

test('--probe sees a live slot holder and a refused --gpu form, and agrees with the real run each time', () => {
  const b = box();
  const slot = join(b.dir, 'lanejob-mac.slot');
  mkdirSync(slot);
  writeFileSync(join(slot, 'pid'), String(process.pid));
  assert.equal(b.run(['--probe', 'true']).stdout.trim(), 'would=skip reason=slot-busy');
  assert.equal(b.run(['true']).status, 75);
  writeFileSync(join(slot, 'pid'), '999999');   // a dead holder: the probe says mac and the run reclaims it
  assert.equal(b.run(['--probe', 'true']).stdout.trim(), 'would=mac');
  assert.equal(b.run(['true']).status, 0);
  const rows = join(b.dir, 'rows.txt');
  writeFileSync(rows, 'node scripts/only-check.mjs\n');
  assert.equal(b.run(['--probe', '--gpu', '--', 'npm', 'test'], { LANEJOB_MAC_ROWS: rows }).stdout.trim(), 'would=refuse');
  assert.equal(b.run(['--probe', '--gpu', '--', 'node', 'scripts/only-check.mjs'], { LANEJOB_MAC_ROWS: rows }).stdout.trim(), 'would=mac');
});
