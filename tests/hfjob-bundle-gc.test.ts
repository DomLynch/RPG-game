// hfjob bundle-gc + the Auditor's hardening of --bundle: full-file secret scan (no 8 MB blind spot), no symlinks/hardlinks in bundles or results, orphan cleanup with history squash.
// Local only: tmp dirs and a stub huggingface_hub module; no network, no token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bundlePy = join(process.cwd(), 'scripts/hfjob/bundle.py');
const script = join(process.cwd(), 'scripts/hfjob/hfjob.sh');
const genv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const fakeHf = () => 'hf_' + 'a1B2'.repeat(9);
const py = (args: string[], env: NodeJS.ProcessEnv = {}) => spawnSync('python3', [bundlePy, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60000 });

function repo(setup: (work: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'hfgc-')), work = join(dir, 'w');
  execFileSync('git', ['init', '-q', work], { stdio: 'ignore' });
  setup(work);
  execFileSync('git', ['add', '-A'], { cwd: work, env: genv, stdio: 'ignore' });
  execFileSync('git', ['commit', '-q', '-m', 'x'], { cwd: work, env: genv, stdio: 'ignore' });
  return { dir, work, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('pack scans the WHOLE file: a token after 8 MB, and one split across a chunk edge, are both refused', () => {
  for (const offset of [9 * 1048576, 8 * 1048576 - 10]) {
    const c = repo((w) => { writeFileSync(join(w, 'ok.js'), 'ok'); const b = Buffer.alloc(offset + 100, 0x61); b.write(fakeHf(), offset); writeFileSync(join(w, 'big.bin'), b); });
    try {
      const r = py(['pack', '--root', c.work, '--out', join(c.dir, 'b.tgz')]);
      assert.equal(r.status, 2, `offset ${offset}`);
      assert.match(r.stderr, /refused: big\.bin contains a Hugging Face token/);
    } finally { c.done(); }
  }
});

test('scan (the VPS re-scan) also reads past 8 MB', () => {
  const c = repo((w) => writeFileSync(join(w, 'ok.js'), 'ok'));
  try {
    const big = Buffer.alloc(9 * 1048576 + 100, 0x62); big.write(fakeHf(), 9 * 1048576); writeFileSync(join(c.work, 'late.bin'), big);
    const tar = join(c.dir, 't.tgz'); execFileSync('tar', ['-czf', tar, '-C', c.work, 'late.bin']);
    const r = py(['scan', tar]);
    assert.equal(r.status, 2); assert.match(r.stderr, /late\.bin contains a Hugging Face token/);
  } finally { c.done(); }
});

test('links: pack drops every symlink (in or out of the tree); scan refuses an archive with a symlink or a hardlink', () => {
  const c = repo((w) => { writeFileSync(join(w, 'a.js'), 'a'); symlinkSync('a.js', join(w, 'inner-link')); });
  try {
    const r = py(['pack', '--root', c.work, '--out', join(c.dir, 'b.tgz')]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).skipped_links, ['inner-link']);
    assert.ok(!execFileSync('tar', ['-tzf', join(c.dir, 'b.tgz')], { encoding: 'utf8' }).includes('inner-link'));
    const mk = (kind: 'sym' | 'hard') => {
      const out = join(c.dir, `${kind}.tgz`);
      execFileSync('python3', ['-c', `import tarfile,io,sys
t=tarfile.open(sys.argv[1],"w:gz")
i=tarfile.TarInfo("a.js");i.size=1;t.addfile(i,io.BytesIO(b"a"))
l=tarfile.TarInfo("l");l.type=tarfile.${kind === 'sym' ? 'SYMTYPE' : 'LNKTYPE'};l.linkname="a.js";t.addfile(l)
t.close()`, out]);
      return out;
    };
    for (const k of ['sym', 'hard'] as const) {
      const s = py(['scan', mk(k)]);
      assert.equal(s.status, 2, k); assert.match(s.stderr, new RegExp(`l is a ${k === 'sym' ? 'symlink' : 'hardlink'}`));
    }
  } finally { c.done(); }
});

test('collect-side extraction refuses links too (streamed extract and safe_members)', () => {
  const c = repo((w) => writeFileSync(join(w, 'a.js'), 'a'));
  try {
    const tar = join(c.dir, 'l.tgz');
    execFileSync('python3', ['-c', `import tarfile,io,sys
t=tarfile.open(sys.argv[1],"w:gz")
i=tarfile.TarInfo("hfjob-out/a");i.size=1;t.addfile(i,io.BytesIO(b"a"))
l=tarfile.TarInfo("hfjob-out/b");l.type=tarfile.LNKTYPE;l.linkname="hfjob-out/a";t.addfile(l)
t.close()`, tar]);
    const ex = spawnSync('python3', ['-I', bundlePy, 'extract', '--out', join(c.dir, 'o')], { input: readFileSync(tar), encoding: 'utf8' });
    assert.equal(ex.status, 2); assert.match(ex.stderr, /unsafe member/);
    const sm = spawnSync('python3', ['-c', `import sys,tarfile
sys.path.insert(0,${JSON.stringify(join(process.cwd(), 'scripts/hfjob'))})
import bundle
list(bundle.safe_members(tarfile.open(sys.argv[1])))`, tar], { encoding: 'utf8' });
    assert.equal(sm.status, 2); assert.match(sm.stderr, /hardlink/);
  } finally { c.done(); }
});

test('gc_plan: everything older than N hours (unknown date counts as old) and nothing newer', () => {
  const r = spawnSync('python3', ['-c', `import sys,json
sys.path.insert(0,${JSON.stringify(join(process.cwd(), 'scripts/hfjob'))})
import bundle
now=1000000
print(json.dumps(bundle.gc_plan([("bundles/new",now-3600),("bundles/old",now-30*3600),("results/edge",now-24*3600+1),("results/unknown",0)],now,24)))`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ['bundles/old', 'results/unknown']);
});

test('bundle-gc end to end against a stub huggingface_hub: deletes only the old entries in one commit, squashes history, --dry-run changes nothing, a public repo is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfgcstub-'));
  try {
    const stub = join(dir, 'huggingface_hub'); mkdirSync(stub);
    writeFileSync(join(stub, '__init__.py'), `import datetime, json, os
LOG = os.environ["STUB_LOG"]
def _log(x):
    open(LOG, "a").write(json.dumps(x) + "\\n")
class CommitOperationDelete:
    def __init__(self, path_in_repo): self.path_in_repo = path_in_repo
class _D:
    def __init__(self, **k): self.__dict__.update(k)
class HfApi:
    def repo_info(self, rid, repo_type=None): return _D(private=os.environ.get("STUB_PUBLIC") != "1")
    def create_repo(self, *a, **k): _log("create_repo")
    def list_repo_tree(self, rid, path_in_repo=None, repo_type=None, expand=False):
        now = datetime.datetime.now(datetime.timezone.utc)
        h = lambda n: _D(date=now - datetime.timedelta(hours=n))
        rows = {"bundles": [("bundles/fresh.tar.gz", 1), ("bundles/orphan.tar.gz", 50)], "results": [("results/done.tar.gz", 30)]}
        for p, n in rows[path_in_repo]: yield _D(path=p, type="file", last_commit=h(n))
        if path_in_repo == "results": yield _D(path="results/sub", type="directory")
    def create_commit(self, rid, repo_type=None, operations=None, commit_message=None): _log({"delete": [o.path_in_repo for o in operations]})
    def super_squash_history(self, repo_id=None, repo_type=None): _log("squash")
`);
    const env = { PYTHONPATH: dir, HF_TOKEN: fakeHf(), STUB_LOG: join(dir, 'calls.log') };
    const calls = () => { try { return readFileSync(env.STUB_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    const dry = py(['gc', '--hours', '24', '--dry-run'], env);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /3 remote entries, 2 older than 24h \(dry run\)/);
    assert.deepEqual(calls(), [], 'a dry run changes nothing');
    const r = py(['gc', '--hours', '24'], env);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(calls(), [{ delete: ['bundles/orphan.tar.gz', 'results/done.tar.gz'] }, 'squash']);
    assert.ok(!(r.stdout + r.stderr).includes(env.HF_TOKEN), 'the token is never printed');
    rmSync(env.STUB_LOG);
    py(['gc', '--hours', '100'], env);
    assert.deepEqual(calls(), [], 'nothing old, nothing squashed');
    py(['gc', '--hours', '100', '--squash'], env);
    assert.deepEqual(calls(), ['squash'], '--squash forces a squash');
    rmSync(env.STUB_LOG);
    py(['gc', '--hours', '24', '--no-squash'], env);
    assert.deepEqual(calls(), [{ delete: ['bundles/orphan.tar.gz', 'results/done.tar.gz'] }], '--no-squash keeps history');
    const pub = py(['gc'], { ...env, STUB_PUBLIC: '1' });
    assert.equal(pub.status, 2); assert.match(pub.stderr, /is PUBLIC/);
    assert.equal(py(['gc', '--hours', 'soon'], env).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hfjob bundle-gc is wired: the VPS script and the Mac wrapper both pass it through', () => {
  assert.match(readFileSync(script, 'utf8'), /bundle-gc\) shift; with_token; exec python3 "\$here\/bundle\.py" gc/);
  assert.match(readFileSync(join(process.cwd(), 'scripts/hfjob/hfjob-mac.sh'), 'utf8'), /\|bundle-gc\)/);
});
