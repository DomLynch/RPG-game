// scripts/vps-shadow/capture.sh v6/v7 (COO 2026-10-09): the job runs through lanejob; a job starts only under the 5-min load line; a job tagged
// --hf-ok that is still waiting after the spill wait, with the box STILL over the line, runs once on Hugging Face (cpu-upgrade, Deploy's node:22
// image), is cancelled after a quiet spell, and leaves one spill.log line. Real bash, flock and /proc; stubbed hf, npm, lanejob and ionice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const script = join(process.cwd(), 'scripts/vps-shadow/capture.sh');
const linux = existsSync('/proc/loadavg') && (() => { try { execFileSync('flock', ['-V'], { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; } })();
const skip = linux ? false : 'needs Linux (flock, /proc): runs on the VPS / CI';
const run = promisify(execFile);

const STUBS: Record<string, string> = {
  lanejob: 'echo "$*" > "$STUB/lanejob-ran"; exec "$@"',
  ionice: 'while [[ "${1:-}" == -* ]]; do shift; done; exec "$@"',
  npm: 'echo "$*" > "$STUB/npm-ran"',
  hf: `echo "$*" >> "$STUB/hf-calls"
case "$1 $2" in
  "auth whoami") exit "\${HF_STUB_AUTH:-0}" ;;
  "jobs run") [[ -n "\${HF_STUB_LAUNCH_FAIL:-}" ]] && { echo "Error: no quota"; exit 1; }; echo "Job started with ID: job123" ;;
  "jobs logs") echo "capture-spill: abc npm test"; [[ -n "\${HF_STUB_QUIET:-}" ]] || echo "# pass 3" ;;
  "jobs inspect") [[ -n "\${HF_STUB_QUIET:-}" ]] && echo '{"status": {"stage": "RUNNING"}}' || echo '{"status": {"stage": "COMPLETED"}}' ;;
esac`,
};

async function capture(args: string[], load: string, env: Record<string, string> = {}, setup?: (repo: string) => void, lowerAfterMs?: number) {
  const dir = mkdtempSync(join(tmpdir(), 'capture-gate-')), stub = join(dir, 'bin'), home = join(dir, 'home'), repo = join(dir, 'repo');
  execFileSync('mkdir', ['-p', stub, home, repo], { timeout: 5000 });
  for (const [name, body] of Object.entries(STUBS)) { writeFileSync(join(stub, name), `#!/bin/bash\n${body}\n`); chmodSync(join(stub, name), 0o755); }
  const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { timeout: 10000, stdio: 'ignore' });
  git('init', '-q'); writeFileSync(join(repo, 'a.txt'), 'a\n'); git('add', '.'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'a');
  setup?.(repo);
  const loadavg = join(dir, 'loadavg'); writeFileSync(loadavg, `${load} 1/100 1\n`);
  if (lowerAfterMs) setTimeout(() => writeFileSync(loadavg, '1.00 1.00 1.00 1/100 1\n'), lowerAfterMs);
  let out: string, code = 0;
  try {
    const r = await run('bash', [script, ...args], { cwd: repo, timeout: 30000, env: { ...process.env, PATH: `${stub}:${process.env.PATH}`, STUB: dir, SHADOW_HOME: home, CAPTURE_LOADAVG: loadavg,
      CAPTURE_HF: join(stub, 'hf'), CAPTURE_WAIT_S: '4', CAPTURE_SPILL_AFTER_S: '1', CAPTURE_HF_POLL_S: '0.2', ...env } });
    out = r.stdout + r.stderr;
  } catch (e) { const x = e as { code: number; stdout: string; stderr: string }; code = x.code; out = x.stdout + x.stderr; }
  const read = (f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '');
  return { code, out, ran: read('npm-ran'), lanejob: read('lanejob-ran'), hf: read('hf-calls'), spill: read('home/capture.spill.log'), queue: read('home/capture.queue') };
}

test('the job runs through lanejob (the live copy\'s line since the 10-08 OOM)', { skip }, async () => {
  assert.match(readFileSync(script, 'utf8'), /nice -n 15 ionice -c3 lanejob "\$@" 9>&- &/);
  const r = await capture(['t', 'npm', 'test'], '1.00 1.00 1.00');
  assert.equal(r.code, 0, r.out); assert.equal(r.lanejob.trim(), 'npm test'); assert.equal(r.ran.trim(), 'test');
});

test('a job starts only while the 5-minute load is under the line (not the 1-minute)', { skip }, async () => {
  const [over5, over1] = await Promise.all([capture(['t', 'npm', 'test'], '1.00 20.00 20.00'), capture(['t', 'npm', 'test'], '20.00 1.00 1.00')]);
  assert.equal(over5.code, 75, over5.out); assert.equal(over5.ran, ''); assert.match(over5.out, /load5 20\.00 \(starts under 12\)/);
  assert.equal(over1.code, 0, over1.out); assert.equal(over1.ran.trim(), 'test');
});

test('a tagged job still over the line after the wait spills once to HF cpu-upgrade in node:22, logs its line, and leaves the VPS queue', { skip }, async () => {
  const r = await capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00');
  assert.equal(r.code, 0, r.out); assert.equal(r.ran, '', 'nothing ran on the VPS');
  const launch = r.hf.split('\n').find((l) => l.startsWith('jobs run'))!;
  assert.match(launch, /^jobs run --flavor cpu-upgrade --timeout 40m --detach node:22 bash -c /);
  assert.match(launch, /git fetch -q --depth 1 origin [0-9a-f]{40};.*npm ci .*exec npm test $/);
  assert.equal(r.hf.split('\n').filter((l) => l.startsWith('jobs run')).length, 1);
  assert.match(r.spill, /^\S+Z lane=t hf_job=job123 stage=COMPLETED waited_s=\d+ load5=20\.00 run_s=\d+ cost_usd=\d+\.\d{4} sha=[0-9a-f]{40} cmd=npm test \n$/);
  assert.match(r.out, /# pass 3/, 'the HF log streams back to the caller'); assert.equal(r.queue.trim(), '');
});

test('a tagged job stays on the VPS when the load clears before the spill point; an untagged job never spills', { skip }, async () => {
  const [cleared, untagged] = await Promise.all([
    capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', { CAPTURE_SPILL_AFTER_S: '3' }, undefined, 1000),
    capture(['t', 'npm', 'test'], '1.00 20.00 20.00'),
  ]);
  assert.equal(cleared.code, 0, cleared.out); assert.equal(cleared.ran.trim(), 'test'); assert.doesNotMatch(cleared.hf, /jobs run/);
  assert.equal(untagged.code, 75, untagged.out); assert.doesNotMatch(untagged.hf, /jobs run/);
});

test('--hf-ok is refused for browsers, release steps, other commands, a dirty checkout and no HF login: the job stays VPS-only', { skip }, async () => {
  const cases: Array<[string[], Record<string, string>, ((repo: string) => void) | undefined, RegExp]> = [
    [['npx', 'playwright', 'test'], {}, undefined, /names a browser/],
    [['node', 'scripts/browser-check.mjs'], {}, undefined, /names a browser/],
    [['bash', 'scripts/deploy.sh'], {}, undefined, /names a browser, the server/],
    [['node', '--test', 'scripts/x.mjs'], {}, undefined, /takes only tests\/ or origins\//],
    [['npm', 'run', 'build'], {}, undefined, /npm run takes only/],
    [['npm', 'test'], {}, (repo) => writeFileSync(join(repo, 'a.txt'), 'changed\n'), /uncommitted changes/],
    [['npm', 'test'], { HF_STUB_AUTH: '1' }, undefined, /no Hugging Face login/],
  ];
  const results = await Promise.all(cases.map(([cmd, env, setup]) => capture(['--hf-ok', 't', ...cmd], '1.00 20.00 20.00', env, setup)));
  results.forEach((r, i) => {
    assert.match(r.out, cases[i]![3], `${cases[i]![0].join(' ')}: ${r.out}`); assert.match(r.out, /stays on the VPS/);
    assert.equal(r.code, 75); assert.doesNotMatch(r.hf, /jobs run/);
  });
});

test('a spilled job with no new output for the quiet spell is cancelled and logged; a failed launch keeps the job in the VPS queue', { skip }, async () => {
  const [quiet, failed] = await Promise.all([
    capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', { HF_STUB_QUIET: '1', CAPTURE_HF_QUIET_S: '1' }),
    capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', { HF_STUB_LAUNCH_FAIL: '1' }),
  ]);
  assert.equal(quiet.code, 1, quiet.out); assert.match(quiet.hf, /^jobs cancel job123$/m);
  assert.match(quiet.spill, / stage=CANCELED quiet_cancel=1s /); assert.match(quiet.out, /no output for 1s/);
  assert.equal(failed.code, 75, failed.out); assert.match(failed.out, /HF launch failed \(Error: no quota\)/); assert.equal(failed.spill, '');
});
