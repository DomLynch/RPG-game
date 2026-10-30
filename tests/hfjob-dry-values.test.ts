// HFJOB_DRY fails CLOSED: any non-empty value except 0/false/no/off (any case) is a dry run, in hfjob.sh, hfjob-mac.sh and bundle.py. 0/false/no/off/empty are live.
// Same stubs as hfjob-dry.test.ts: an ssh that runs the remote command locally, an `hf` that records and fails, a recording huggingface_hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const vps = join(root, 'scripts/hfjob/hfjob.sh'), mac = join(root, 'scripts/hfjob/hfjob-mac.sh'), bundlePy = join(root, 'scripts/hfjob/bundle.py');
const genv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const DRY_VALUES = ['1', 'true', 'yes', 'TRUE', 'on', 'Yes', 'ON', '2', 'dry', ' 1'];
const LIVE_VALUES = ['0', 'false', 'FALSE', 'no', 'No', 'off', 'OFF', ''];

function world() {
  const dir = mkdtempSync(join(tmpdir(), 'hfdv-')), bin = join(dir, 'bin'), hub = join(dir, 'pylib', 'huggingface_hub'), work = join(dir, 'secret-repo');
  mkdirSync(bin); mkdirSync(hub, { recursive: true });
  const calls = join(dir, 'calls.log'); writeFileSync(calls, '');
  writeFileSync(join(bin, 'ssh'), `#!/bin/bash\nfor last; do :; done\necho "SSH" >> "$STUB_CALLS"\nexec bash -c "$last"\n`);
  writeFileSync(join(bin, 'hf'), `#!/bin/bash\necho "HF-CLI" >> "$STUB_CALLS"\nexit 99\n`);
  for (const f of ['ssh', 'hf']) chmodSync(join(bin, f), 0o755);
  writeFileSync(join(hub, '__init__.py'), `import datetime, os
LOG = os.environ["STUB_CALLS"]
def _log(x): open(LOG, "a").write(x + "\\n")
class CommitOperationDelete:
    def __init__(self, path_in_repo): self.path_in_repo = path_in_repo
class _D:
    def __init__(self, **k): self.__dict__.update(k)
class HfApi:
    def repo_info(self, rid, repo_type=None): return _D(private=True)
    def list_repo_tree(self, rid, path_in_repo=None, repo_type=None, expand=False):
        old = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=100)
        if path_in_repo == "results": yield _D(path="results/${'a'.repeat(24)}.tar.gz", type="file", last_commit=_D(date=old))
    def create_repo(self, *a, **k): _log("MUTATION create_repo")
    def upload_file(self, *a, **k): _log("MUTATION upload_file")
    def delete_file(self, *a, **k): _log("MUTATION delete_file")
    def create_commit(self, *a, **k): _log("MUTATION create_commit")
    def super_squash_history(self, *a, **k): _log("MUTATION super_squash_history")
`);
  execFileSync('git', ['init', '-q', work], { stdio: 'ignore' });
  writeFileSync(join(work, 'a.js'), 'a');
  execFileSync('git', ['add', '-A'], { cwd: work, env: genv, stdio: 'ignore' }); execFileSync('git', ['commit', '-q', '-m', 'x'], { cwd: work, env: genv, stdio: 'ignore' });
  const run = (script: string, args: string[], dryValue: string | undefined) => {
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}`, PYTHONPATH: join(dir, 'pylib'), STUB_CALLS: calls, HF_TOKEN: 'hf_' + 'x1Y2'.repeat(9),
      HFJOB_BIN: join(bin, 'hf'), HFJOB_REMOTE_HFJOB: `bash ${vps}`, HFJOB_LEDGER: join(dir, 'ledger'), HFJOB_BUNDLE_PY: bundlePy };
    delete env.HFJOB_DRY; if (dryValue !== undefined) env.HFJOB_DRY = dryValue;
    writeFileSync(calls, '');
    const r = spawnSync('bash', [script, ...args], { cwd: work, env, encoding: 'utf8', timeout: 60000 });
    const log = readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean);
    return { r, mut: log.filter((x) => x.startsWith('MUTATION') || x === 'HF-CLI'), ssh: log.filter((x) => x === 'SSH').length };
  };
  const py = (args: string[], dryValue: string) => {
    writeFileSync(calls, '');
    const r = spawnSync('python3', [bundlePy, ...args], { cwd: work, env: { ...process.env, PYTHONPATH: join(dir, 'pylib'), STUB_CALLS: calls, HF_TOKEN: 'hf_' + 'x1Y2'.repeat(9), HFJOB_DRY: dryValue, HFJOB_BUNDLE_REPO: 'o/r' }, encoding: 'utf8' });
    return { r, mut: readFileSync(calls, 'utf8').split('\n').filter((x) => x.startsWith('MUTATION')) };
  };
  return { dir, work, run, py, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('dry values (1, true, yes, TRUE, on, Yes, ON, 2, dry, " 1"): hfjob.sh gc deletes nothing and --bundle submits nothing', () => {
  const w = world();
  try {
    for (const v of DRY_VALUES) {
      const gc = w.run(vps, ['bundle-gc', '--hours', '0'], v);
      assert.equal(gc.r.status, 0, `${v}: ${gc.r.stderr}`); assert.deepEqual(gc.mut, [], `gc with HFJOB_DRY=${JSON.stringify(v)}`);
      assert.match(gc.r.stdout, /\(dry run\)/);
      const b = w.run(vps, ['--bundle', '--', 'true'], v);
      assert.equal(b.r.status, 0, `${v}: ${b.r.stderr}`); assert.deepEqual(b.mut, [], `--bundle with HFJOB_DRY=${JSON.stringify(v)}`);
      assert.match(b.r.stderr, /dry run: bundle/);
    }
  } finally { w.done(); }
});

test('dry values: the Mac wrapper sends nothing over ssh and submits nothing; a forwarded gc stays dry on the VPS', () => {
  const w = world();
  try {
    for (const v of DRY_VALUES) {
      const b = w.run(mac, ['--bundle', '--', 'true'], v);
      assert.equal(b.r.status, 0, `${v}: ${b.r.stderr}`); assert.equal(b.ssh, 0, `Mac --bundle with HFJOB_DRY=${JSON.stringify(v)} used ssh`); assert.deepEqual(b.mut, []);
      const gc = w.run(mac, ['bundle-gc', '--hours', '0'], v);
      assert.equal(gc.ssh, 1); assert.deepEqual(gc.mut, [], `forwarded gc with HFJOB_DRY=${JSON.stringify(v)}`);
    }
  } finally { w.done(); }
});

test('dry values: bundle.py called directly refuses to mutate', () => {
  const w = world();
  try {
    for (const v of DRY_VALUES) {
      const gc = w.py(['gc', '--hours', '0'], v); assert.equal(gc.r.status, 0, gc.r.stderr); assert.deepEqual(gc.mut, [], `gc ${JSON.stringify(v)}`);
      const tar = join(w.dir, 't.tgz'); execFileSync('tar', ['-czf', tar, '-C', w.work, 'a.js']);
      const up = w.py(['upload', tar, '--id', '12345678-1234-1234-1234-123456789abc'], v); assert.equal(up.r.status, 0); assert.deepEqual(up.mut, []);
    }
  } finally { w.done(); }
});

test('live values (0, false, FALSE, no, No, off, OFF, empty, unset) are live: gc deletes and squashes, the Mac wrapper really goes to ssh, bundle.py uploads', () => {
  const w = world();
  try {
    for (const v of [...LIVE_VALUES, undefined]) {
      const label = JSON.stringify(v);
      const gc = w.run(vps, ['bundle-gc', '--hours', '0'], v);
      assert.equal(gc.r.status, 0, `${label}: ${gc.r.stderr}`); assert.deepEqual(gc.mut, ['MUTATION create_commit', 'MUTATION super_squash_history'], `HFJOB_DRY=${label} must be live`);
      const m = w.run(mac, ['--bundle', '--', 'true'], v);
      assert.ok(m.ssh >= 2, `Mac --bundle with HFJOB_DRY=${label} must go to ssh (tarball + run), got ${m.ssh}`);
      assert.ok(m.mut.includes('MUTATION upload_file'), `HFJOB_DRY=${label}: the VPS side must upload (then the stub hf fails the submit)`);
    }
    const tar = join(w.dir, 't.tgz'); execFileSync('tar', ['-czf', tar, '-C', w.work, 'a.js']);
    for (const v of LIVE_VALUES) assert.deepEqual(w.py(['upload', tar, '--id', '12345678-1234-1234-1234-123456789abc'], v).mut, ['MUTATION upload_file'], `bundle.py upload with ${JSON.stringify(v)}`);
  } finally { w.done(); }
});
