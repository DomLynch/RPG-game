// scripts/hfjob/hfjob.sh --bundle + scripts/hfjob/bundle.py: private checkouts on HF CPU. Everything here is local (HFJOB_DRY, tmp dirs, stub scripts): no network, no HF call, no token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/hfjob/hfjob.sh');
const bundlePy = join(process.cwd(), 'scripts/hfjob/bundle.py');
const genv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (args: string[], cwd: string) => execFileSync('git', args, { cwd, env: genv, stdio: 'ignore', timeout: 10000 });
const py = (args: string[], env: NodeJS.ProcessEnv = {}) => spawnSync('python3', ['-I', bundlePy, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 20000 });
const tarList = (tar: string) => execFileSync('tar', ['-tzf', tar], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
// token-shaped strings are built at run time so no token-looking literal is committed
const fakeHf = () => 'hf_' + 'a1B2'.repeat(9);

// a PRIVATE checkout: no remote at all (that is the point), one commit, untracked files on top
function priv(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'hfbundle-')), work = join(dir, 'secret-repo');
  execFileSync('git', ['init', '-q', work], { stdio: 'ignore' });
  writeFileSync(join(work, '.gitignore'), 'ignored.txt\n');
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(work, p, '..'), { recursive: true }); writeFileSync(join(work, p), c); }
  git(['add', '-A'], work); git(['commit', '-q', '-m', 'x'], work);
  return { dir, work, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const pack = (work: string, dir: string, extra: string[] = []) => py(['pack', '--root', work, '--out', join(dir, 'b.tar.gz'), ...extra]);

test('pack: tracked + untracked files go in; .git, node_modules, .env*, keys, tokens, ignored files and a stale hfjob-out stay out', () => {
  const c = priv({
    'src/a.js': 'a', 'package.json': '{}', 'package-lock.json': '{}',
    'node_modules/x/index.js': 'x', '.env': 'A=1', '.env.local': 'A=2', 'certs/server.pem': 'p', 'keys/deploy.key': 'k', 'home/id_rsa': 'i', 'home/id_ed25519.pub': 'i',
    'credentials.json': '{}', 'config/secrets.yml': 's', '.npmrc': 'n', 'tok/token': 't', 'hfjob-out/old.txt': 'o',
  });
  try {
    writeFileSync(join(c.work, 'untracked.txt'), 'u'); writeFileSync(join(c.work, 'ignored.txt'), 'i');
    const r = pack(c.work, c.dir);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(tarList(join(c.dir, 'b.tar.gz')), ['.gitignore', 'package-lock.json', 'package.json', 'src/a.js', 'untracked.txt']);
    assert.equal(JSON.parse(r.stdout).files, 5);
  } finally { c.done(); }
});

test('pack: --include adds a path the manifest would not carry (an untracked art folder inside an ignored dir), --exclude drops globs; includes still never carry secrets', () => {
  const c = priv({ 'src/a.js': 'a', 'big/model.glb': 'g', 'big/notes.md': 'n' });
  try {
    mkdirSync(join(c.work, 'art/raw'), { recursive: true }); writeFileSync(join(c.work, 'art/raw/x.png'), 'png'); writeFileSync(join(c.work, 'art/raw/.env'), 'S=1');
    writeFileSync(join(c.work, '.gitignore'), 'art/\nignored.txt\n'); git(['add', '-A'], c.work); git(['commit', '-q', '-m', 'ig'], c.work);
    const r = pack(c.work, c.dir, ['--include', 'art', '--exclude', '*.glb']);
    assert.equal(r.status, 0, r.stderr);
    const names = tarList(join(c.dir, 'b.tar.gz'));
    assert.ok(names.includes('art/raw/x.png'), names.join());
    assert.ok(!names.includes('art/raw/.env'), '.env stays out even through --include');
    assert.ok(!names.includes('big/model.glb'), '--exclude *.glb');
    assert.ok(names.includes('big/notes.md'));
    for (const bad of ['/etc', '../x', 'nope']) assert.equal(pack(c.work, c.dir, ['--include', bad]).status, 2, bad);
  } finally { c.done(); }
});

test('pack: refuses on a credential-looking CONTENT pattern, names the file and the kind, and writes no tarball', () => {
  const kinds: [string, string, RegExp][] = [
    ['hf.txt', `token=${fakeHf()}`, /Hugging Face token/],
    ['gh.txt', 'x=ghp_' + 'Z9y8'.repeat(9), /GitHub token/],
    ['sk.txt', 'k=sk-' + 'Qw3rTy'.repeat(6), /API secret key/],
    ['pk.txt', '-----BEGIN ' + 'RSA PRIVATE KEY-----\nabc', /private key header/],
  ];
  for (const [file, body, what] of kinds) {
    const c = priv({ 'ok.js': 'ok', [`src/${file}`]: body });
    try {
      const r = pack(c.work, c.dir);
      assert.equal(r.status, 2, file);
      assert.match(r.stderr, new RegExp(`refused: src/${file.replace('.', '\\.')} contains a `));
      assert.match(r.stderr, what);
      assert.ok(!existsSync(join(c.dir, 'b.tar.gz')), 'nothing packed');
      assert.ok(!r.stderr.includes(body.slice(0, 30)) && !r.stdout.includes(body.slice(0, 30)), 'the secret itself is never printed');
    } finally { c.done(); }
  }
});

test('pack: --include of a credential-named file never ships it (dropped by the always-exclude list)', () => {
  const c = priv({ 'ok.js': 'ok' });
  try {
    writeFileSync(join(c.work, 'deploy.pem'), 'x');
    const r = pack(c.work, c.dir, ['--include', 'deploy.pem']);
    assert.equal(r.status, 0, 'always-excluded names are dropped quietly, never shipped');
    assert.deepEqual(tarList(join(c.dir, 'b.tar.gz')), ['.gitignore', 'ok.js']);
  } finally { c.done(); }
});

test('pack: size cap refuses above --max-mb and prints the largest entries', () => {
  const c = priv({ 'a.bin': 'x'.repeat(10), 'small.txt': 's' });
  try {
    writeFileSync(join(c.work, 'huge.dat'), Buffer.alloc(3 * 1048576, 1)); writeFileSync(join(c.work, 'mid.dat'), Buffer.alloc(1048576, 2));
    const r = pack(c.work, c.dir, ['--max-mb', '2']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /bundle is 4\.0 MB > --max-mb 2/);
    assert.match(r.stderr, /3\.0 MB\s+huge\.dat\n.*1\.0 MB\s+mid\.dat/s);
    assert.equal(pack(c.work, c.dir, ['--max-mb', '5']).status, 0);
    assert.equal(pack(c.work, c.dir, ['--max-mb', 'lots']).status, 2);
  } finally { c.done(); }
});

test('pack: a symlink out of the checkout is dropped and reported, never followed', () => {
  const c = priv({ 'a.js': 'a' });
  try {
    symlinkSync('/etc/hosts', join(c.work, 'hosts')); git(['add', '-A'], c.work); git(['commit', '-q', '-m', 'l'], c.work);
    const r = pack(c.work, c.dir);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!tarList(join(c.dir, 'b.tar.gz')).includes('hosts'));
    assert.deepEqual(JSON.parse(r.stdout).skipped_links, ['hosts']);
  } finally { c.done(); }
});

test('scan: the VPS re-scans a tarball it receives (a name or content the packer would have refused, a path escape)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfscan-'));
  try {
    const mk = (name: string, body: string) => { const d = join(dir, name); mkdirSync(d); writeFileSync(join(d, name === 'envd' ? '.env' : 'f.txt'), body); execFileSync('tar', ['-czf', join(dir, `${name}.tgz`), '-C', d, '.']); return join(dir, `${name}.tgz`); };
    assert.equal(py(['scan', mk('good', 'fine')]).status, 0);
    assert.equal(py(['scan', mk('envd', 'A=1')]).status, 2);
    const leaked = py(['scan', mk('leak', fakeHf())]);
    assert.equal(leaked.status, 2); assert.match(leaked.stderr, /Hugging Face token/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hfjob --bundle dry run: no git origin needed, one detached cpu job, the token travels as a job SECRET by name, the bundle goes to the private repo path, nothing is uploaded', () => {
  const c = priv({ 'src/a.js': 'a', 'package-lock.json': '{}' });
  try {
    const r = spawnSync('bash', [script, '--bundle', '--include', 'src', '--timeout', '45m', '--out', 'render', '--out', 'hfjob-out/x', '--', 'node', '--test', 'it has spaces', '$HOME;rm'], { cwd: c.work, env: { ...process.env, HFJOB_DRY: '1', HF_TOKEN: fakeHf() }, encoding: 'utf8', timeout: 20000 });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /jobs run --detach --timeout 45m --flavor cpu-upgrade --label lane=secret-repo --secrets HF_TOKEN /);
    assert.match(r.stdout, /HFJOB_BUNDLE_REPO=Domlynch\/hfjob-bundles/);
    assert.match(r.stdout, /HFJOB_OUT=render\\ hfjob-out\/x/);
    assert.match(r.stderr, /would go to private dataset Domlynch\/hfjob-bundles as bundles\/[0-9a-f-]{36}\.tar\.gz; nothing uploaded/);
    assert.ok(!r.stdout.includes(fakeHf()) && !r.stderr.includes(fakeHf()), 'the token value is never printed');
    assert.doesNotMatch(r.stdout, /HF_TOKEN=/, 'HF_TOKEN has no value anywhere in argv');
    assert.doesNotMatch(r.stdout, /github\.com|HFJOB_SHA|HFJOB_REPO=/, 'no git credential, no clone: the job gets only the bundle');
    const b64 = /HFJOB_ARGV_B64=([A-Za-z0-9+/=]+)/.exec(r.stdout)![1];
    const decoded = Buffer.from(b64, 'base64').toString();
    const back = execFileSync('bash', ['-c', `set -- ${decoded}; printf '%s\\n' "$@"`], { encoding: 'utf8' }).split('\n').slice(0, -1);
    assert.deepEqual(back, ['node', '--test', 'it has spaces', '$HOME;rm'], 'argument boundaries survive');
  } finally { c.done(); }
});

test('hfjob --bundle refusals exit 2: a secret in the tree, over the cap, --box, bad --out, flags without --bundle, not a checkout; the public-sha path is unchanged', () => {
  const c = priv({ 'a.js': 'a' });
  const plain = mkdtempSync(join(tmpdir(), 'hfplain-'));
  try {
    const run = (cwd: string, args: string[]) => spawnSync('bash', [script, ...args], { cwd, env: { ...process.env, HFJOB_DRY: '1' }, encoding: 'utf8', timeout: 20000 });
    assert.match(run(c.work, ['--bundle', '--box', 'v3', '--', 'true']).stderr, /cannot be combined/);
    assert.match(run(c.work, ['--bundle', '--out', '../etc', '--', 'true']).stderr, /relative path inside the checkout/);
    assert.match(run(c.work, ['--bundle', '--max-mb', 'x', '--', 'true']).stderr, /--max-mb must be a whole number/);
    assert.match(run(c.work, ['--include', 'a.js', '--', 'true']).stderr, /only make sense with --bundle/);
    assert.match(run(plain, ['--bundle', '--', 'true']).stderr, /not inside a git checkout/);
    writeFileSync(join(c.work, 'leak.txt'), fakeHf());
    const leak = run(c.work, ['--bundle', '--', 'true']);
    assert.equal(leak.status, 2); assert.match(leak.stderr, /refused: leak\.txt contains a Hugging Face token/);
    assert.equal(run(c.work, ['--bundle']).status, 2, 'no command');
    assert.doesNotMatch(run(c.work, ['--', 'true']).stderr + run(c.work, ['--', 'true']).stdout, /bundle/, 'without --bundle nothing bundle-related runs');
  } finally { c.done(); rmSync(plain, { recursive: true, force: true }); }
});

test('--batch: each non-comment line is one call (quoting kept), run concurrently, output in input order, failures reported with the line number and a non-zero exit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfbatch-'));
  try {
    const stub = join(dir, 'stub.sh');
    writeFileSync(stub, '#!/bin/bash\nif [ "$1" = fail ]; then echo "hfjob: boom" >&2; exit 1; fi\nsleep "$1"\necho "tier=hf-cpu job=$(printf %024d "$2") args=$#"\necho "follow: x"\n'); chmodSync(stub, 0o755);
    const f = join(dir, 'jobs.txt');
    writeFileSync(f, '# a comment\n\n0.6 1 -- "two words" three\n0.1 2 --bundle --include src -- npm test\nfail\n0 4\n');
    const t0 = Date.now();
    const r = py(['batch', f, '--script', stub]);
    assert.equal(r.status, 1);
    assert.deepEqual(r.stdout.trim().split('\n'), [
      `tier=hf-cpu job=${'1'.padStart(24, '0')} args=5`, `tier=hf-cpu job=${'2'.padStart(24, '0')} args=7`, `tier=hf-cpu job=${'4'.padStart(24, '0')} args=2`]);
    assert.match(r.stderr, /line 5 failed \(rc=1\): hfjob: boom/);
    assert.ok(Date.now() - t0 < 1500, 'concurrent, not serial');
    writeFileSync(f, 'collect abc\n'); assert.equal(py(['batch', f, '--script', stub]).status, 2);
    writeFileSync(f, '# nothing\n'); assert.equal(py(['batch', f, '--script', stub]).status, 2);
    writeFileSync(f, '"unterminated\n'); assert.equal(py(['batch', f, '--script', stub]).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('collect --all-from: ids come from a file of submit lines, bare ids or a comma list; each lands in OUT/<id>', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfcol-'));
  try {
    const a = 'a'.repeat(24), b = 'b1'.repeat(12), d = 'c'.repeat(24);
    const stub = join(dir, 'stub.sh'); writeFileSync(stub, '#!/bin/bash\necho "collected job=$2 to $4"\n'); chmodSync(stub, 0o755);
    const f = join(dir, 'ids.txt'); writeFileSync(f, `tier=hf-cpu job=${a} repo=x sha=1 bundle=u files=2 mb=0.1\n${b}\njunk\ntier=hf-cpu job=${a} again\n`);
    const r = py(['collect-all', f, '--out', join(dir, 'out'), '--script', stub]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split('\n'), [`collected job=${a} to ${join(dir, 'out', a)}`, `collected job=${b} to ${join(dir, 'out', b)}`]);
    assert.equal(py(['collect-all', `${a},${d}`, '--out', join(dir, 'o2'), '--script', stub]).stdout.trim().split('\n').length, 2);
    assert.equal(py(['collect-all', 'nothing here', '--out', dir, '--script', stub]).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('collect/extract: results extract under the named dir only; links, devices and .. members are refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfext-'));
  try {
    const src = join(dir, 'src'); mkdirSync(join(src, 'hfjob-out'), { recursive: true }); writeFileSync(join(src, 'hfjob-out/r.txt'), 'ok');
    execFileSync('tar', ['-czf', join(dir, 'ok.tgz'), '-C', src, 'hfjob-out']);
    const ex = (tgz: string, out: string) => spawnSync('python3', ['-I', bundlePy, 'extract', '--out', out], { input: readFileSync(tgz), encoding: 'utf8' });
    assert.equal(ex(join(dir, 'ok.tgz'), join(dir, 'out')).status, 0);
    assert.equal(readFileSync(join(dir, 'out/hfjob-out/r.txt'), 'utf8'), 'ok');
    symlinkSync('/etc', join(src, 'hfjob-out/link')); execFileSync('tar', ['-czf', join(dir, 'link.tgz'), '-C', src, 'hfjob-out']);
    const bad = ex(join(dir, 'link.tgz'), join(dir, 'out2'));
    assert.equal(bad.status, 2); assert.match(bad.stderr, /unsafe member/);
    execFileSync('python3', ['-c', 'import tarfile,io,sys;t=tarfile.open(sys.argv[1],"w:gz");i=tarfile.TarInfo("../evil");i.size=1;t.addfile(i,io.BytesIO(b"x"));t.close()', join(dir, 'dots.tgz')]);
    assert.equal(ex(join(dir, 'dots.tgz'), join(dir, 'out3')).status, 2);
    assert.ok(!existsSync(join(dir, 'evil')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the job body never echoes the token, and the Mac wrapper reads no secret', () => {
  const inner = readFileSync(join(process.cwd(), 'scripts/hfjob/inner-bundle.sh'), 'utf8');
  assert.doesNotMatch(inner, /echo[^\n]*HF_TOKEN|printf[^\n]*HF_TOKEN|set -x|bash -x/);
  const mac = readFileSync(join(process.cwd(), 'scripts/hfjob/hfjob-mac.sh'), 'utf8');
  assert.doesNotMatch(mac, /HF_TOKEN|\.hf\/token|\/etc\/hfjob/);
  const sh = readFileSync(script, 'utf8');
  assert.doesNotMatch(sh, /-e "HF_TOKEN|--secrets HF_TOKEN=/, 'the secret is passed by name only');
});
