// scripts/hfjob/hfjob.sh (Strategy + Dom 2026-10-27, "any dev any time can use hugging face 0.03 cpu"): ONE repo-agnostic command that runs a command on an HF CPU job at the
// current checkout's pushed HEAD. No repo name lives in the script; it reads origin and HEAD of the cwd. Everything here uses HFJOB_DRY or a stub `hf`, in tmp dirs: no network, no HF call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/hfjob/hfjob.sh');
const genv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (args: string[], cwd: string) => execFileSync('git', args, { cwd, env: genv, stdio: 'ignore', timeout: 10000 });

// a checkout whose origin is `origin`; pushed = HEAD is on a remote-tracking ref
function checkout(origin: string, pushed = true) {
  const dir = mkdtempSync(join(tmpdir(), 'hfjob-')), work = join(dir, 'work');
  execFileSync('git', ['init', '-q', work], { stdio: 'ignore' });
  writeFileSync(join(work, 'f'), 'x');
  git(['add', 'f'], work); git(['commit', '-q', '-m', 'x'], work);
  git(['remote', 'add', 'origin', origin], work);
  if (pushed) git(['update-ref', 'refs/remotes/origin/main', 'HEAD'], work);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: work, encoding: 'utf8' }).trim();
  return { dir, work, sha, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const run = (cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) => spawnSync('bash', [script, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 20000 });

test('dry run: submits a detached node:22 cpu-upgrade job for THIS checkout\'s origin and HEAD, with the defaults', () => {
  const c = checkout('https://github.com/acme/Frankendom-v3.git');
  try {
    const r = run(c.work, ['--', 'npm', 'test'], { HFJOB_DRY: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /jobs run --detach --timeout 30m --flavor cpu-upgrade /);
    assert.match(r.stdout, new RegExp(`HFJOB_REPO=https://github\\.com/acme/Frankendom-v3\\.git`));
    assert.ok(r.stdout.includes(`HFJOB_SHA=${c.sha}`));
    assert.match(r.stdout, / node:22 bash -c /);
    assert.doesNotMatch(r.stdout, /HF_TOKEN|hf_[A-Za-z0-9]{10}/);
    assert.doesNotMatch(r.stdout, /--label sha=/, 'the HF API rejects a "sha" label key (labels.sha: Invalid key in record, smoke 2026-10-27); the sha is in the env and the ledger');
  } finally { c.done(); }
});

test('no repo name in the script, and the job installs only when there is a lockfile', () => {
  const src = readFileSync(script, 'utf8');
  assert.doesNotMatch(src, /DomLynch|RPG-game|Frankendom-v3|physics\.git|armagedom/i, 'no repo names in the code');
  assert.match(src, /if \[ -f package-lock\.json \]/);
});

test('origin forms: ssh and a missing .git become the https .git URL; --timeout and --flavor pass through; HFJOB_REPO overrides', () => {
  const c = checkout('git@github.com:acme/physics.git');
  try {
    const r = run(c.work, ['--timeout', '2h', '--flavor', 'cpu-basic', '--', 'true'], { HFJOB_DRY: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /HFJOB_REPO=https:\/\/github\.com\/acme\/physics\.git/);
    assert.match(r.stdout, /--timeout 2h --flavor cpu-basic/);
    git(['remote', 'set-url', 'origin', 'https://github.com/acme/opentrident'], c.work);
    assert.match(run(c.work, ['--', 'true'], { HFJOB_DRY: '1' }).stdout, /HFJOB_REPO=https:\/\/github\.com\/acme\/opentrident\.git/);
    assert.match(run(c.work, ['--', 'true'], { HFJOB_DRY: '1', HFJOB_REPO: 'https://github.com/o/n.git' }).stdout, /HFJOB_REPO=https:\/\/github\.com\/o\/n\.git/);
  } finally { c.done(); }
});

test('refusals say why and exit 2: no command, bad timeout, a GPU flavor, an unpushed HEAD, a non-github origin, not a checkout', () => {
  const c = checkout('https://github.com/acme/x.git');
  const local = checkout('/nonexistent/origin.git', false);
  const plain = mkdtempSync(join(tmpdir(), 'hfjob-plain-'));
  try {
    for (const [cwd, args, why] of [
      [c.work, [], /usage: hfjob/],
      [c.work, ['--timeout', '90', '--', 'true'], /--timeout must look like 30m or 2h/],
      [c.work, ['--flavor', 't4-small', '--', 'true'], /not a CPU flavor.*gpu-run\.mjs/],
      [local.work, ['--', 'true'], /HEAD [0-9a-f]{9} is not pushed/],
      [plain, ['--', 'true'], /not inside a git checkout/],
    ] as const) {
      const r = run(cwd, [...args], { HFJOB_DRY: '1' });
      assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
      assert.match(r.stderr, why);
    }
    git(['remote', 'set-url', 'origin', 'https://gitlab.com/a/b.git'], c.work);
    const g = run(c.work, ['--', 'true'], { HFJOB_DRY: '1' });
    assert.equal(g.status, 2);
    assert.match(g.stderr, /not a plain public https:\/\/github\.com\/<owner>\/<name> URL/);
  } finally { c.done(); local.done(); rmSync(plain, { recursive: true, force: true }); }
});

test('the command keeps its argument boundaries: decoded from the job env, it runs exactly as typed', () => {
  const c = checkout('https://github.com/acme/x.git');
  try {
    const r = run(c.work, ['--', 'bash', '-c', 'echo "$0|$1"', 'a b', 'c;d $HOME'], { HFJOB_DRY: '1' });
    assert.equal(r.status, 0, r.stderr);
    const b64 = /HFJOB_ARGV_B64=([A-Za-z0-9+/=]+)/.exec(r.stdout)?.[1] ?? '';
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    assert.equal(execFileSync('bash', ['-c', decoded], { encoding: 'utf8' }).trim(), 'a b|c;d $HOME');
  } finally { c.done(); }
});

test('real path with a stub hf: prints the tier line and the logs line, appends the ledger, never prints the token', () => {
  const c = checkout('https://github.com/acme/Frankendom-v3.git');
  try {
    const hf = join(c.dir, 'hf'), seen = join(c.dir, 'hf-seen'), ledger = join(c.dir, 'ledger.log');
    writeFileSync(hf, `#!/bin/sh\nprintf '%s\\n' "$@" > ${seen}\necho "token=$HF_TOKEN" >> ${seen}\necho "Job started with ID: ${'b'.repeat(24)}"\n`); chmodSync(hf, 0o755);
    const r = run(c.work, ['--', 'node', '--test'], { HFJOB_BIN: hf, HFJOB_LEDGER: ledger, HF_TOKEN: 'hf_SECRETSECRETSECRET' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(`tier=hf-cpu job=${'b'.repeat(24)} repo=acme/Frankendom-v3 sha=${c.sha.slice(0, 12)}`), r.stdout);
    assert.ok(r.stdout.includes(`hfjob logs ${'b'.repeat(24)}`));
    assert.doesNotMatch(r.stdout + r.stderr, /SECRETSECRET/);
    assert.match(readFileSync(seen, 'utf8'), /^jobs\nrun\n--detach\n/);
    assert.match(readFileSync(ledger, 'utf8'), new RegExp(`tier=hf-cpu job=${'b'.repeat(24)} repo=acme/Frankendom-v3 .*flavor=cpu-upgrade timeout=30m`));
    // logs|inspect|cancel|ps pass straight through to `hf jobs`, with the token in the hf process's env only
    const l = run(c.work, ['logs', 'x1'], { HFJOB_BIN: hf, HF_TOKEN: 'hf_SECRETSECRETSECRET' });
    assert.equal(l.status, 0, l.stderr);
    assert.match(readFileSync(seen, 'utf8'), /^jobs\nlogs\nx1\ntoken=hf_SECRETSECRETSECRET/);
    assert.doesNotMatch(l.stdout.replace('Job started with ID', '') + l.stderr, /SECRETSECRET/);
    // ps/logs/inspect/cancel need no git checkout (Strategy 2026-10-27): they work from any cwd
    const anywhere = run(tmpdir(), ['ps', '-a'], { HFJOB_BIN: hf });
    assert.equal(anywhere.status, 0, anywhere.stderr);
    assert.match(readFileSync(seen, 'utf8'), /^jobs\nps\n-a\n/);
    // hf failing is exit 1 with its last line, not a silent success
    writeFileSync(hf, '#!/bin/sh\necho "quota exceeded" >&2; exit 3\n');
    const f = run(c.work, ['--', 'true'], { HFJOB_BIN: hf, HFJOB_LEDGER: ledger });
    assert.equal(f.status, 1);
    assert.match(f.stderr, /hf jobs run failed \(rc=3\): quota exceeded/);
    assert.equal(readFileSync(ledger, 'utf8').trim().split('\n').length, 1, 'a failed submit is not ledgered');
    assert.equal(existsSync(join(c.dir, 'no-such')), false);
  } finally { c.done(); }
});
