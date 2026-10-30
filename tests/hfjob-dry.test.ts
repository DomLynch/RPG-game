// HFJOB_DRY=1 must be honoured end to end: hfjob-mac.sh (forwarded over ssh), hfjob.sh and bundle.py, for --bundle, --batch, collect and bundle-gc.
// Stubs: an `ssh` that runs the remote command locally, an `hf` CLI that fails the test if called, and a huggingface_hub module that records every call.
// Under HFJOB_DRY any MUTATION call (upload/create/delete/commit/squash/download) or any hf submit is a failure. A non-dry control run proves the stubs do see mutations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const vps = join(root, 'scripts/hfjob/hfjob.sh'), mac = join(root, 'scripts/hfjob/hfjob-mac.sh'), bundlePy = join(root, 'scripts/hfjob/bundle.py');
const genv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const JOB = 'a'.repeat(24);

function world(opts: { repoExists?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hfdry-')), bin = join(dir, 'bin'), hub = join(dir, 'pylib', 'huggingface_hub'), work = join(dir, 'secret-repo');
  mkdirSync(bin); mkdirSync(hub, { recursive: true });
  const calls = join(dir, 'calls.log'); writeFileSync(calls, '');
  // ssh stub: log, then run the remote command locally (stdin passes through)
  writeFileSync(join(bin, 'ssh'), `#!/bin/bash\nfor last; do :; done\necho "SSH $last" >> "$STUB_CALLS"\nexec bash -c "$last"\n`);
  writeFileSync(join(bin, 'hf'), `#!/bin/bash\necho "HF-CLI $*" >> "$STUB_CALLS"\nexit 99\n`);
  for (const f of ['ssh', 'hf']) chmodSync(join(bin, f), 0o755);
  writeFileSync(join(hub, '__init__.py'), `import datetime, os
LOG = os.environ["STUB_CALLS"]
def _log(x): open(LOG, "a").write(x + "\\n")
class RepositoryNotFoundError(Exception): pass
class CommitOperationDelete:
    def __init__(self, path_in_repo): self.path_in_repo = path_in_repo
class _D:
    def __init__(self, **k): self.__dict__.update(k)
class HfApi:
    def repo_info(self, rid, repo_type=None):
        _log("READ repo_info")
        if os.environ.get("STUB_NO_REPO") == "1": raise RepositoryNotFoundError("404")
        return _D(private=True)
    def list_repo_tree(self, rid, path_in_repo=None, repo_type=None, expand=False):
        _log("READ list_repo_tree " + path_in_repo)
        old = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=100)
        if path_in_repo == "results": yield _D(path="results/${JOB}.tar.gz", type="file", last_commit=_D(date=old))
    def inspect_job(self, job_id=None): return _D(status=_D(stage="RUNNING"))
    def create_repo(self, *a, **k): _log("MUTATION create_repo")
    def upload_file(self, *a, **k): _log("MUTATION upload_file")
    def delete_file(self, *a, **k): _log("MUTATION delete_file")
    def create_commit(self, *a, **k): _log("MUTATION create_commit")
    def super_squash_history(self, *a, **k): _log("MUTATION super_squash_history")
def hf_hub_download(*a, **k):
    _log("MUTATION hf_hub_download"); raise RuntimeError("no network in tests")
`);
  // a private checkout: tracked + a credential-named file that must show up as excluded
  execFileSync('git', ['init', '-q', work], { stdio: 'ignore' });
  writeFileSync(join(work, 'a.js'), 'a'); writeFileSync(join(work, '.env'), 'X=1'); writeFileSync(join(work, 'b.js'), 'b');
  execFileSync('git', ['add', '-A', '-f'], { cwd: work, env: genv, stdio: 'ignore' }); execFileSync('git', ['commit', '-q', '-m', 'x'], { cwd: work, env: genv, stdio: 'ignore' });
  const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({ ...process.env, PATH: `${bin}:${process.env.PATH}`, PYTHONPATH: join(dir, 'pylib'), STUB_CALLS: calls, HF_TOKEN: 'hf_' + 'x1Y2'.repeat(9),
    HFJOB_BIN: join(bin, 'hf'), HFJOB_REMOTE_HFJOB: `bash ${vps}`, HFJOB_LEDGER: join(dir, 'ledger'), HFJOB_BUNDLE_PY: bundlePy, STUB_NO_REPO: opts.repoExists === false ? '1' : '0', ...extra });
  const run = (script: string, args: string[], extra: NodeJS.ProcessEnv = {}, cwd = work, input?: string) => spawnSync('bash', [script, ...args], { cwd, env: env(extra), encoding: 'utf8', timeout: 60000, input });
  const log = () => readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean);
  const clean = () => { const l = log(); return { mut: l.filter((x) => x.startsWith('MUTATION') || x.startsWith('HF-CLI')), ssh: l.filter((x) => x.startsWith('SSH')) }; };
  return { dir, work, run, log, clean, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const DRY = { HFJOB_DRY: '1' };

test('control: WITHOUT HFJOB_DRY the stubs do see mutations (so the dry assertions below mean something)', () => {
  const w = world();
  try {
    const r = w.run(vps, ['bundle-gc', '--hours', '0'], {});
    assert.equal(r.status, 0, r.stderr);
    assert.ok(w.clean().mut.some((x) => x === 'MUTATION create_commit'), w.log().join('\n'));
    assert.ok(w.clean().mut.some((x) => x === 'MUTATION super_squash_history'));
  } finally { w.done(); }
});

test('VPS hfjob --bundle under HFJOB_DRY: prints files, MB, the exclusions (names) and the hf command; no upload, no hf call, no repo', () => {
  const w = world();
  try {
    const r = w.run(vps, ['--bundle', '--', 'node', '--version'], DRY);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /dry run: bundle [0-9a-f-]{36} \(2 files, 0\.0 MB\) would go to private dataset .*nothing uploaded, nothing submitted, no repo created/);
    assert.match(r.stderr, /1 names excluded: \.env/);
    assert.match(r.stdout, /jobs run --detach .*--secrets HF_TOKEN/);
    assert.deepEqual(w.clean(), { mut: [], ssh: [] });
    assert.ok(!w.log().some((x) => x.startsWith('READ')), 'a dry bundle does not even read the hub');
  } finally { w.done(); }
});

test('Mac wrapper --bundle under HFJOB_DRY: packs and scans locally, reports files/MB/exclusions, sends NOTHING (no ssh at all), submits nothing', () => {
  const w = world();
  try {
    const r = w.run(mac, ['--bundle', '--timeout', '10m', '--', 'npm', 'test'], DRY);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /dry run: bundle of secret-repo: 2 files, 0\.0 MB .*1 names excluded: \.env/);
    assert.match(r.stderr, /hf jobs run --detach --timeout 10m --flavor cpu-upgrade .*--secrets HF_TOKEN.*nothing sent, nothing uploaded, nothing submitted/);
    assert.deepEqual(w.clean(), { mut: [], ssh: [] }, w.log().join('\n'));
  } finally { w.done(); }
});

test('Mac wrapper forwards HFJOB_DRY over ssh for bundle-gc, collect and passthrough; the VPS side honours it (no mutation, no download)', () => {
  const w = world();
  try {
    const gc = w.run(mac, ['bundle-gc', '--hours', '1'], DRY);
    assert.equal(gc.status, 0, gc.stderr);
    assert.match(gc.stdout, /1 older than 1h \(dry run\)/);
    const col = w.run(mac, ['collect', JOB, '--out', join(w.dir, 'out')], DRY);
    assert.equal(col.status, 0, col.stderr);
    assert.match(col.stderr, /dry run: would download results\/a{24}\.tar\.gz/);
    assert.match(col.stderr, /dry run: would extract into/);
    assert.ok(!existsSync(join(w.dir, 'out')), 'nothing extracted');
    const ssh = w.clean().ssh;
    assert.equal(ssh.length, 2);
    for (const s of ssh) assert.match(s, /^SSH HFJOB_DRY=1 bash .*hfjob\.sh (bundle-gc|collect)/, 'HFJOB_DRY travels with the remote command');
    assert.deepEqual(w.clean().mut, []);
  } finally { w.done(); }
});

test('bundle-gc under HFJOB_DRY with no bundle repo: says so and creates nothing; with entries: lists them and deletes/squashes nothing', () => {
  const none = world({ repoExists: false });
  try {
    const r = none.run(vps, ['bundle-gc'], DRY);
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /does not exist; nothing to do/);
    assert.deepEqual(none.clean().mut, []);
  } finally { none.done(); }
  const w = world();
  try {
    const r = w.run(vps, ['bundle-gc', '--hours', '24'], DRY);
    assert.match(r.stdout, new RegExp(`1 older than 24h \\(dry run\\)[\\s\\S]*results/${JOB}`));
    assert.deepEqual(w.clean().mut, []);
    const flag = w.run(vps, ['bundle-gc', '--hours', '24', '--dry-run'], {});
    assert.match(flag.stdout, /dry run/); assert.deepEqual(w.clean().mut, [], '--dry-run alone never deletes either');
  } finally { w.done(); }
});

test('--batch and collect --all-from under HFJOB_DRY: every line is a dry run, shown with its label; nothing submitted, uploaded or downloaded', () => {
  const w = world();
  try {
    const f = join(w.dir, 'jobs.txt'); writeFileSync(f, `--bundle -- echo one\n--bundle --timeout 5m -- echo two\n`);
    const r = w.run(vps, ['--batch', f], DRY);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[line 1\] \S*hf jobs run --detach/); assert.match(r.stdout, /\[line 2\] \S*hf jobs run --detach .*--timeout 5m/);
    assert.match(r.stdout, /\[line 1\] hfjob: dry run|dry run: bundle/);
    const ids = join(w.dir, 'ids.txt'); writeFileSync(ids, `tier=hf-cpu job=${JOB} repo=x\n`);
    const c = w.run(vps, ['collect', '--all-from', ids, '--out', join(w.dir, 'o')], DRY);
    assert.equal(c.status, 0, c.stderr);
    assert.deepEqual(w.clean(), { mut: [], ssh: [] });
  } finally { w.done(); }
});

test('bundle.py itself refuses every mutating command under HFJOB_DRY, even when called directly (defence if a caller forgets to check)', () => {
  const w = world();
  try {
    const tar = join(w.dir, 't.tgz'); execFileSync('tar', ['-czf', tar, '-C', w.work, 'a.js']);
    const py = (args: string[]) => spawnSync('python3', [bundlePy, ...args], { cwd: w.work, env: { ...process.env, PYTHONPATH: join(w.dir, 'pylib'), STUB_CALLS: join(w.dir, 'calls.log'), HF_TOKEN: 'hf_' + 'x1Y2'.repeat(9), HFJOB_DRY: '1', HFJOB_BUNDLE_REPO: 'o/r' }, encoding: 'utf8' });
    for (const args of [['upload', tar, '--id', '12345678-1234-1234-1234-123456789abc'], ['drop', '12345678-1234-1234-1234-123456789abc'], ['collect', JOB, '--out', join(w.dir, 'x')], ['collect', JOB, '--discard'], ['gc', '--hours', '0']]) {
      const r = py(args); assert.equal(r.status, 0, `${args[0]}: ${r.stderr}`);
    }
    assert.deepEqual(w.clean().mut, []);
  } finally { w.done(); }
});

test('usage lists --bundle, --batch, collect and bundle-gc (VPS script and Mac wrapper)', () => {
  const w = world();
  try {
    for (const s of [vps, mac]) {
      const r = w.run(s, [], {}, w.dir);
      assert.equal(r.status, 2);
      for (const word of ['--bundle', '--batch', 'collect', 'bundle-gc', 'HFJOB_DRY=1']) assert.ok(r.stderr.includes(word), `${s.split('/').pop()} usage lacks ${word}`);
    }
  } finally { w.done(); }
});
