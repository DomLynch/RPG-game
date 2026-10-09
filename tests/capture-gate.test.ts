// scripts/vps-shadow/capture.sh v6-v8 (COO, Lead 2026-10-09): the job runs through lanejob; a job starts only under the 5-min load line; a job tagged
// --hf-ok that is still waiting after the spill wait, with the box STILL over the line, is handed to its caller (exit 76 + a CAPTURE_SPILL line) and
// scripts/capture-mac.sh runs it once on Hugging Face (cpu-upgrade, Deploy's node:22 image) with the Mac's login, cancels it after a quiet spell, and
// appends the result to the VPS spill.log. Real bash, flock and /proc; stubbed ssh (runs locally), hf, npm, lanejob and ionice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const script = join(process.cwd(), 'scripts/vps-shadow/capture.sh'), mac = join(process.cwd(), 'scripts/capture-mac.sh');
const linux = existsSync('/proc/loadavg') && (() => { try { execFileSync('flock', ['-V'], { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; } })();
const skip = linux ? false : 'needs Linux (flock, /proc): runs on the VPS / CI';
const run = promisify(execFile);

const STUBS: Record<string, string> = {
  lanejob: 'echo "$*" > "$STUB/lanejob-ran"; exec "$@"',
  ionice: 'while [[ "${1:-}" == -* ]]; do shift; done; exec "$@"',
  npm: 'echo "$*" > "$STUB/npm-ran"; exit "${NPM_EXIT:-0}"',
  ssh: 'shift; exec bash -c "$1"',   // "host" then the remote command line: run it here
  capture: 'exec bash "$CAPTURE_SCRIPT" "$@"',
  hf: `echo "$*" >> "$STUB/hf-calls"
case "$1 $2" in
  "auth whoami") exit "\${HF_STUB_AUTH:-0}" ;;
  "jobs run") [[ -n "\${HF_STUB_LAUNCH_FAIL:-}" ]] && { echo "Error: no quota"; exit 1; }; echo "Job started with ID: job123" ;;
  "jobs logs") echo "capture-spill: abc npm test"; [[ -n "\${HF_STUB_QUIET:-}" ]] || echo "# pass 3" ;;
  "jobs inspect") [[ -n "\${HF_STUB_QUIET:-}" ]] && echo '{"status": {"stage": "RUNNING"}}' || echo '{"status": {"stage": "COMPLETED"}}' ;;
esac`,
};

async function capture(args: string[], load: string, env: Record<string, string> = {}, setup?: (repo: string) => void, lowerAfterMs?: number, viaMac = false) {
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
    const r = await run('bash', viaMac ? [mac, '--host', 'vps', '--dir', repo, ...args] : [script, ...args], { cwd: repo, timeout: 30000, env: { ...process.env, PATH: `${stub}:${process.env.PATH}`, STUB: dir, SHADOW_HOME: home,
      CAPTURE_LOADAVG: loadavg, CAPTURE_SCRIPT: script, CAPTURE_SSH: join(stub, 'ssh'), CAPTURE_HF: join(stub, 'hf'), CAPTURE_WAIT_S: '4', CAPTURE_SPILL_AFTER_S: '1', CAPTURE_HF_POLL_S: '0.2', ...env } });
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

test('the VPS hands a tagged job still over the line to its caller: exit 76, the sha and the command, a HANDED line, out of the queue, never HF', { skip }, async () => {
  const r = await capture(['--hf-ok', '--spill-to-caller', 't', 'npm', 'test'], '1.00 20.00 20.00');
  assert.equal(r.code, 76, r.out); assert.equal(r.ran, '', 'nothing ran on the VPS'); assert.equal(r.hf, '', 'the VPS never calls hf'); assert.equal(r.queue.trim(), '');
  const spill = /^CAPTURE_SPILL log=(\S+) sha=([0-9a-f]{40}) args=(\S+)$/m.exec(r.out)!;
  assert.ok(spill, r.out); assert.match(spill[1]!, /capture\.spill\.log$/);
  assert.equal(Buffer.from(spill[3]!, 'base64').toString(), 'npm\0test\0');
  assert.match(r.spill, /^\S+Z lane=t stage=HANDED waited_s=\d+ load5=20\.00 sha=[0-9a-f]{40} cmd=npm test \n$/);
});

test('capture-mac.sh runs the handed job once on HF cpu-upgrade in node:22, streams its log, and appends the result to the VPS spill log', { skip }, async () => {
  const r = await capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', {}, undefined, undefined, true);
  assert.equal(r.code, 0, r.out); assert.equal(r.ran, '', 'nothing ran on the VPS');
  const launch = r.hf.split('\n').find((l) => l.startsWith('jobs run'))!;
  assert.match(launch, /^jobs run --flavor cpu-upgrade --timeout 40m --detach node:22 bash -c /);
  assert.match(launch, /git fetch -q --depth 1 origin [0-9a-f]{40};.*npm ci .*exec npm test $/);
  assert.equal(r.hf.split('\n').filter((l) => l.startsWith('jobs run')).length, 1); assert.doesNotMatch(r.hf, /auth whoami/);
  const [handed, result] = r.spill.trimEnd().split('\n');
  assert.match(handed!, / lane=t stage=HANDED /);
  assert.match(result!, /^\S+Z lane=t hf_job=job123 stage=COMPLETED run_s=\d+ cost_usd=\d+\.\d{4} sha=[0-9a-f]{40} cmd=npm test ?$/);   // trimEnd took the %q trailing space
  assert.match(r.out, /# pass 3/, 'the HF log streams back to the caller'); assert.equal(r.queue.trim(), '');
});

test('a tagged job stays on the VPS when the load clears before the spill point; an untagged job never spills; a job\'s own exit 76 is not a spill', { skip }, async () => {
  const [cleared, untagged, own76] = await Promise.all([
    capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', { CAPTURE_SPILL_AFTER_S: '3' }, undefined, 1000, true),
    capture(['t', 'npm', 'test'], '1.00 20.00 20.00', {}, undefined, undefined, true),
    capture(['--hf-ok', 't', 'npm', 'test'], '1.00 1.00 1.00', { NPM_EXIT: '76' }, undefined, undefined, true),
  ]);
  assert.equal(cleared.code, 0, cleared.out); assert.equal(cleared.ran.trim(), 'test'); assert.doesNotMatch(cleared.hf, /jobs run/);
  assert.equal(untagged.code, 75, untagged.out); assert.doesNotMatch(untagged.hf, /jobs run/);
  assert.equal(own76.code, 76, own76.out); assert.equal(own76.ran.trim(), 'test'); assert.equal(own76.hf, '', 'no CAPTURE_SPILL line, so no HF');
});

test('--hf-ok is refused for browsers, release steps, other commands, a dirty checkout and a caller that cannot launch HF: the job stays VPS-only', { skip }, async () => {
  const cases: Array<[string[], string[], ((repo: string) => void) | undefined, RegExp]> = [
    [['npx', 'playwright', 'test'], ['--spill-to-caller'], undefined, /names a browser/],
    [['node', 'scripts/browser-check.mjs'], ['--spill-to-caller'], undefined, /names a browser/],
    [['bash', 'scripts/deploy.sh'], ['--spill-to-caller'], undefined, /names a browser, the server/],
    [['node', '--test', 'scripts/x.mjs'], ['--spill-to-caller'], undefined, /takes only tests\/ or origins\//],
    [['npm', 'run', 'build'], ['--spill-to-caller'], undefined, /npm run takes only/],
    [['npm', 'test'], ['--spill-to-caller'], (repo) => writeFileSync(join(repo, 'a.txt'), 'changed\n'), /uncommitted changes/],
    [['npm', 'test'], [], undefined, /no caller to run it on Hugging Face/],
  ];
  const results = await Promise.all(cases.map(([cmd, extra, setup]) => capture(['--hf-ok', ...extra, 't', ...cmd], '1.00 20.00 20.00', {}, setup)));
  results.forEach((r, i) => {
    assert.match(r.out, cases[i]![3], `${cases[i]![0].join(' ')}: ${r.out}`); assert.match(r.out, /stays on the VPS/);
    assert.equal(r.code, 75); assert.equal(r.hf, ''); assert.doesNotMatch(r.out, /CAPTURE_SPILL/);
  });
});

test('a spilled job with no new output for the quiet spell is cancelled and logged; a failed launch puts the job back in the VPS queue without --hf-ok', { skip }, async () => {
  const [quiet, failed] = await Promise.all([
    capture(['--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', { HF_STUB_QUIET: '1', CAPTURE_HF_QUIET_S: '1' }, undefined, undefined, true),
    capture(['--prio', '2', '--hf-ok', 't', 'npm', 'test'], '1.00 20.00 20.00', { HF_STUB_LAUNCH_FAIL: '1' }, undefined, 2500, true),
  ]);
  assert.equal(quiet.code, 1, quiet.out); assert.match(quiet.hf, /^jobs cancel job123$/m);
  assert.match(quiet.spill, / stage=CANCELED quiet_cancel=1s /); assert.match(quiet.out, /no output for 1s/);
  assert.match(failed.out, /HF launch failed \(Error: no quota\)/); assert.match(failed.out, /goes back to the VPS queue/);
  assert.equal(failed.code, 0, failed.out); assert.equal(failed.ran.trim(), 'test', 'it ran on the VPS once the load cleared');
  assert.equal(failed.spill.trim().split('\n').length, 1, 'only the HANDED line: nothing ran on HF'); assert.match(failed.out, /prio 2/);
});
