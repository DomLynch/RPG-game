// scripts/hf-vps: Hugging Face jobs submitted from the VPS (Dom 2026-10-21; Strategy's conditions on the PR). The Mac shim (scripts/hf-vps/bin/hf) sends the arguments to
// scripts/hf-vps/box.sh over ssh; here ssh is a stub that runs the remote command locally and the hf binary is a stub, so the real protocol, quoting, ledger and
// ssh-drop cleanup run end to end. The token must reach hf only as an environment variable inside the box script: never in the ssh command line, never in any output.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SHIM = join(process.cwd(), 'scripts', 'hf-vps', 'bin', 'hf');
const TOKEN = 'hf_TESTTOKEN_0123456789abcdef';
const JOB = 'a1b2c3d4e5f60718293a4b5c';

function setup(submit: 'mac' | 'vps') {
  const dir = mkdtempSync(join(tmpdir(), 'hf-vps-'));
  const file = (name: string, text: string, mode = 0o755) => { const p = join(dir, name); writeFileSync(p, text); chmodSync(p, mode); return p; };
  const log = join(dir, 'hf.log'), sshlog = join(dir, 'ssh.log'), ledger = join(dir, 'ledger');
  // the stub hf: records its arguments and whether it was given the token, then answers like the real CLI
  const hf = file('hf-stub', `#!/usr/bin/env bash
printf 'ARGS:' >> "${log}"; for a in "$@"; do printf ' [%s]' "$a" >> "${log}"; done; printf '\\n' >> "${log}"
echo "TOKEN_OK=$([[ "\${HF_TOKEN:-}" == "${TOKEN}" ]] && echo yes || echo no)" >> "${log}"
sf=""; prev=""; for a in "$@"; do [[ "$prev" == "--secrets-file" ]] && sf="$a"; prev="$a"; done
[[ -n "$sf" ]] && { echo "SECRETS: $(cat "$sf") MODE: $(stat -f %Lp "$sf" 2>/dev/null || stat -c %a "$sf")" >> "${log}"; echo "$sf" > "${dir}/secrets.path"; }
case "$1 $2" in
  "jobs run") sleep "\${STUB_RUN_SLEEP:-0}"; echo "Job started with ID: ${JOB}"; echo "warn on stderr" >&2;;
  "jobs cancel") echo "cancelled $3";;
  "jobs inspect") echo '[{"status":{"stage":"RUNNING"}}]';;
  "fail now") echo "boom" >&2; exit 7;;
esac
`);
  // the stub ssh: records its argv (the token must never appear there) and runs the remote command string locally, stdin passed through
  const ssh = file('ssh-stub', `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${sshlog}"
cmd="\${@: -1}"; exec bash -c "$cmd"
`);
  const cfg = file('hf-submit.json', JSON.stringify({ submit, host: 'root@box', sshKey: '~/key', sshConnectTimeoutS: 5, ledgerDir: ledger, reapSlackS: 300 }), 0o644);
  const tokenFile = file('token', TOKEN + '\n', 0o600);
  const env = { ...process.env, HF_SUBMIT_JSON: cfg, HF_SUBMIT_SSH: ssh, HF_SUBMIT_REAL_HF: hf, HF_VPS_HF: hf, HF_VPS_TOKEN_FILE: tokenFile, HF_VPS_LEDGER_DIR: ledger };
  const run = (...args: string[]) => spawnSync(SHIM, args, { encoding: 'utf8', timeout: 60_000, env });
  const text = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  return { dir, log, sshlog, ledger, env, run, text, tokenFile };
}

test('submit=mac runs the Mac hf unchanged and never touches ssh', () => {
  const t = setup('mac');
  const r = t.run('jobs', 'inspect', 'abc');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /RUNNING/);
  assert.equal(t.text(t.sshlog), '');
  assert.match(t.text(t.log), /TOKEN_OK=no/);
});

test('submit=vps: odd arguments arrive intact, the token reaches hf only in its environment, exit code and stderr come back', () => {
  const t = setup('vps');
  const odd = "it's \"quoted\" $(touch pwned) `x`; a b\nsecond line";
  const r = t.run('jobs', 'inspect', odd);
  assert.equal(r.status, 0);
  assert.ok(t.text(t.log).includes(`[jobs] [inspect] [${odd}]`), 'the argument is byte-identical on the box');
  assert.match(t.text(t.log), /TOKEN_OK=yes/);
  assert.equal(existsSync(join(process.cwd(), 'pwned')), false);
  const everything = r.stdout + r.stderr + t.text(t.sshlog) + t.text(t.log);
  assert.ok(!everything.includes(TOKEN), 'the token appears in no output, no ssh command line and no log');
  const failed = t.run('fail', 'now');
  assert.equal(failed.status, 7);
  assert.match(failed.stderr, /boom/);
});

test('a --secrets-file is rebuilt on the box as a 0600 file and removed afterwards', () => {
  const t = setup('vps');
  const secrets = join(t.dir, 'secrets.env'); writeFileSync(secrets, 'VITE_SUPABASE_URL=https://example.invalid\n');
  const r = t.run('jobs', 'run', '--detach', '--timeout', '45m', '--env', 'SHA=' + 'ab'.repeat(20), '--secrets-file', secrets, 'img', 'bash', '-c', 'echo hi');
  assert.equal(r.status, 0);
  assert.match(t.text(t.log), /SECRETS: VITE_SUPABASE_URL=https:\/\/example\.invalid MODE: 600/);
  assert.notEqual(t.text(join(t.dir, 'secrets.path')).trim(), secrets, 'the box used its own copy');
  assert.equal(existsSync(t.text(join(t.dir, 'secrets.path')).trim()), false, 'removed when the call ended');
});

test('jobs run is ledgered on the box with its timeout and sha; jobs cancel clears it (.ledger becomes .done)', () => {
  const t = setup('vps');
  const sha = 'cd'.repeat(20);
  const r = t.run('jobs', 'run', '--detach', '--timeout', '45m', '--env', `SHA=${sha}`, 'img');
  assert.equal(r.status, 0);
  assert.match(r.stdout, new RegExp(`Job started with ID: ${JOB}`));
  const line = t.text(join(t.ledger, `${sha}.ledger`)).trim();
  assert.match(line, new RegExp(`^${JOB} 2700 \\d+$`));
  assert.equal(t.run('jobs', 'cancel', JOB).status, 0);
  assert.equal(existsSync(join(t.ledger, `${sha}.ledger`)), false);
  assert.equal(existsSync(join(t.ledger, `${sha}.done`)), true);
});

test('ssh dropped while the job started: the box cancels it, writes the ledger and dropped.log (Strategy condition 4)', () => {
  const t = setup('vps');
  const sha = 'ef'.repeat(20);
  // the Mac side is gone before the box prints the job id: the shim's stdout goes to a reader that has already exited
  const r = spawnSync('bash', ['-c', `"${SHIM}" jobs run --detach --timeout 10m --env SHA=${sha} img | true`], { encoding: 'utf8', timeout: 60_000, env: { ...t.env, STUB_RUN_SLEEP: '1' } });
  assert.equal(r.status, 0);
  assert.match(t.text(t.log), new RegExp(`\\[jobs\\] \\[cancel\\] \\[${JOB}\\]`), 'hf jobs cancel ran on the box');
  assert.match(t.text(join(t.ledger, 'dropped.log')), new RegExp(`${JOB} cancelled: ssh dropped`));
  assert.equal(existsSync(join(t.ledger, `${sha}.ledger`)), false, 'nothing left in the live ledger');
  assert.ok(readdirSync(t.ledger).some(f => f === `${sha}.done`), 'the ledger was written, then closed');
});

test('a job live past its own timeout + slack is reaped by the next jobs run on the box', () => {
  const t = setup('vps');
  const old = '99'.repeat(20), stale = 'f0e1d2c3b4a5968778695a4b';
  mkdirSync(t.ledger, { recursive: true });
  writeFileSync(join(t.ledger, `${old}.ledger`), `${stale} 600 ${Math.floor(Date.now() / 1000) - 5000}\n`);
  const r = t.run('jobs', 'run', '--detach', '--timeout', '10m', '--env', 'SHA=' + '77'.repeat(20), 'img');
  assert.equal(r.status, 0);
  assert.match(t.text(t.log), new RegExp(`\\[jobs\\] \\[cancel\\] \\[${stale}\\]`));
  assert.match(t.text(join(t.ledger, 'dropped.log')), new RegExp(`${stale} reaped`));
});

test('the data row defaults to the Mac path and the box script is the only file that names the token file', () => {
  const row = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'lib', 'hf-submit.json'), 'utf8'));
  assert.ok(['mac', 'vps'].includes(row.submit));
  const offenders = ['scripts/hf-vps/bin/hf', 'scripts/lib/hf-submit.json', 'scripts/lib/hf-submit-path.sh', 'scripts/hf-wall-rows.mjs'].filter(f => /\.hf\/token/.test(readFileSync(join(process.cwd(), f), 'utf8')));
  assert.deepEqual(offenders, []);
  assert.match(readFileSync(join(process.cwd(), 'scripts', 'hf-vps', 'box.sh'), 'utf8'), /\.hf\/token/);
});
