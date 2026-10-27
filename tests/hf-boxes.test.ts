// hfjob --box (Dom 2026-10-27): standing HF CPU boxes, one private Space per lane. Everything here is offline: a stub `huggingface_hub` module on PYTHONPATH stands in for the Hub, and the real
// in-Space runner (scripts/hfjob/box/runner.mjs) runs on localhost against a throwaway local git repo. No HF call, no token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const boxes = join(root, 'scripts/hfjob/boxes.py'), hfjob = join(root, 'scripts/hfjob/hfjob.sh'), runner = join(root, 'scripts/hfjob/box/runner.mjs'), inner = join(root, 'scripts/hfjob/inner.sh');
const rows = JSON.parse(readFileSync(join(root, 'data/hf-boxes.json'), 'utf8'));

// a fake Hub: records every call in $STUB_LOG, answers runtime reads from $STUB_STAGE / $STUB_SLEEP, and says the Space exists unless STUB_ABSENT=1
const stub = `
import json, os
def _log(*a): open(os.environ['STUB_LOG'], 'a').write(json.dumps(a) + '\\n')
class _RT:
    def __init__(s): s.stage = os.environ.get('STUB_STAGE', 'RUNNING'); s.hardware = 'cpu-upgrade'; s.sleep_time = int(os.environ.get('STUB_SLEEP', '900'))
class HfApi:
    def __init__(s, token=None): _log('token_given', bool(token))
    def repo_exists(s, sid, repo_type=None): _log('exists', sid); return os.environ.get('STUB_ABSENT') != '1'
    def create_repo(s, sid, **k): _log('create', sid, k)
    def upload_folder(s, **k): _log('upload', sorted(os.listdir(k['folder_path'])))
    def get_space_runtime(s, sid):
        if os.environ.get('STUB_MISSING') == sid: raise Exception('404 not found')
        return _RT()
    def list_jobs(s, namespace=None, token=None):
        class _S: pass
        out = []
        for st in [x for x in os.environ.get('STUB_JOBS', '').split(',') if x]:
            j = _S(); j.status = _S(); j.status.stage = st; out.append(j)
        return out
    def set_space_sleep_time(s, sid, t): _log('set_sleep', sid, t)
    def restart_space(s, sid): _log('restart', sid)
    def pause_space(s, sid): _log('pause', sid)
`;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'hfbox-')), log = join(dir, 'stub.log');
  mkdirSync(join(dir, 'py')); writeFileSync(join(dir, 'py/huggingface_hub.py'), stub);
  const env = { ...process.env, PYTHONPATH: join(dir, 'py'), STUB_LOG: log, HF_TOKEN: 'hf_FAKEFAKEFAKEFAKE', HFJOB_LEDGER: join(dir, 'ledger.log') };
  const calls = () => (readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  return { dir, env, calls, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const py = (env: NodeJS.ProcessEnv, args: string[]) => spawnSync('python3', [boxes, ...args], { env, encoding: 'utf8', timeout: 60000 });

async function freePort() {
  return new Promise<number>((res) => { const s = createServer(); s.listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)); }); });
}
async function startRunner(dir: string) {
  const port = await freePort();
  const child: ChildProcess = spawn('node', [runner], { env: { ...process.env, PORT: String(port), HFBOX_INNER: inner, HFBOX_LOGDIR: join(dir, 'logs'), HFBOX_WORK: join(dir, 'w'), HFBOX_REPO_RE: '^/' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 100)); }
  return { port, stop: () => child.kill() };
}

test('data row: the five lane boxes, a 15 minute sleep, and a CPU flavor; no code names them', () => {
  assert.deepEqual(Object.keys(rows.boxes).sort(), ['armagedom', 'opentrident', 'physics', 'v1', 'v3']);
  assert.equal(rows.sleepMinutes, 15);
  assert.equal(rows.flavor, 'cpu-upgrade');
  for (const f of [boxes, runner, join(root, 'scripts/hfjob/box/Dockerfile.tmpl'), inner]) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /DomLynch|Domlynch|RPG-game|Frankendom-v3|physics\.git|armagedom|opentrident|cpu-upgrade|cpu-basic|\b900\b|\b7860\b/i, `${f}: a repo name, flavor or tuning value is in code`);
  }
});

test('up on a missing Space creates it private, docker, on the row flavor, with the row sleep time, uploads the runner, and prints the sleep receipt', async () => {
  const fx = fixture(), rn = await startRunner(fx.dir);
  try {
    const r = py({ ...fx.env, STUB_ABSENT: '1', HFBOX_URL: `http://127.0.0.1:${rn.port}` }, ['up', 'v3']);
    assert.equal(r.status, 0, r.stderr);
    const c = fx.calls(), create = c.find((x) => x[0] === 'create')!;
    assert.equal(create[1], 'Domlynch/box-v3');
    assert.deepEqual([create[2].space_sdk, create[2].space_hardware, create[2].space_sleep_time, create[2].private], ['docker', 'cpu-upgrade', 900, true]);
    assert.deepEqual(c.find((x) => x[0] === 'upload')![1], ['Dockerfile', 'README.md', 'inner.sh', 'runner.mjs']);
    assert.match(r.stdout, /box=v3 space=Domlynch\/box-v3 stage=RUNNING hardware=cpu-upgrade sleep_time=900s created=yes/);
    assert.doesNotMatch(r.stdout + r.stderr, /FAKEFAKE/);
  } finally { rn.stop(); fx.done(); }
});

test('up on an existing Space with the wrong sleep time fixes it, and a PAUSED one is restarted; a Space that will not take 15 minutes fails loudly', async () => {
  const fx = fixture(), rn = await startRunner(fx.dir), env = { ...fx.env, HFBOX_URL: `http://127.0.0.1:${rn.port}` };
  try {
    const r = py({ ...env, STUB_SLEEP: '3600', STUB_STAGE: 'PAUSED' }, ['up', 'physics']);
    assert.equal(r.status, 1, 'the stub keeps reporting 3600 after set_sleep_time, so the kill switch is not verified');
    assert.match(r.stderr, /sleep_time is 3600, wanted 900; the kill switch is NOT set/);
    const c = fx.calls();
    assert.ok(c.some((x) => x[0] === 'restart' && x[1] === 'Domlynch/box-physics'));
    assert.deepEqual(c.find((x) => x[0] === 'set_sleep'), ['set_sleep', 'Domlynch/box-physics', 900]);
    assert.ok(!c.some((x) => x[0] === 'create'));
  } finally { rn.stop(); fx.done(); }
});

test('an unknown box is refused with the list of known boxes', () => {
  const fx = fixture();
  try {
    const r = py(fx.env, ['up', 'nope']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown box 'nope'; boxes in hf-boxes\.json: v3, physics, armagedom, opentrident, v1/);
  } finally { fx.done(); }
});

test('run on the real runner: clones the sha, runs the command with its argument boundaries, streams the log, prints the tier=hf-box line, exit code follows the job', async () => {
  const fx = fixture(), rn = await startRunner(fx.dir), env = { ...fx.env, HFBOX_URL: `http://127.0.0.1:${rn.port}` };
  const repo = join(fx.dir, 'src.git'), g = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  try {
    mkdirSync(repo); g('init', '-q'); writeFileSync(join(repo, 'hello.txt'), 'from-the-sha'); g('add', '.'); g('commit', '-q', '-m', 'x');
    g('config', 'uploadpack.allowAnySHA1InWant', 'true');
    const sha = g('rev-parse', 'HEAD').trim(), argv = (cmd: string[]) => Buffer.from(cmd.map((a) => `'${a}'`).join(' ')).toString('base64');
    const ok = py(env, ['run', 'armagedom', '--repo', repo, '--sha', sha, '--argv-b64', argv(['sh', '-c', 'cat hello.txt; echo "[$0]"', 'a b']), '--timeout', '60', '--wait']);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, new RegExp(`tier=hf-box box=armagedom repo=.*src sha=${sha.slice(0, 12)} job=[0-9a-f]{12}`));
    assert.match(ok.stdout, /from-the-sha\[a b\]/);
    assert.match(ok.stdout, /job [0-9a-f]{12} done exit=0/);
    const bad = py(env, ['run', 'armagedom', '--repo', repo, '--sha', sha, '--argv-b64', argv(['sh', '-c', 'exit 7']), '--timeout', '60', '--wait']);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /failed exit=7/);
    const refused = await fetch(`http://127.0.0.1:${rn.port}/run`, { method: 'POST', body: JSON.stringify({ repo: 'https://evil.example/x.git', sha, argv_b64: 'AA==', timeout: 5 }) });
    assert.equal(refused.status, 400);
  } finally { rn.stop(); fx.done(); }
});

test('job record: run writes it, and tick (cron) ledgers every end: a finished job, a lost job (404) and a dead box, then forgets them', async () => {
  const fx = fixture(), rn = await startRunner(fx.dir), ledger = fx.env.HFJOB_LEDGER as string, fast = join(fx.dir, 'fast.json'), open = join(fx.dir, 'open.jsonl');
  const env = { ...fx.env, HFBOX_URL: `http://127.0.0.1:${rn.port}`, HFBOX_DATA: fast, HFBOX_OPEN: open };
  writeFileSync(fast, JSON.stringify({ ...rows, watchMaxMisses: 2, watchMarginSeconds: 2 }));
  const argv = Buffer.from("'true'").toString('base64'), lines = () => readFileSync(open, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const future = () => Math.floor(Date.now() / 1000) + 600;
  try {
    const r = py(env, ['run', 'v3', '--repo', '/nonexistent', '--sha', 'a'.repeat(40), '--argv-b64', argv, '--timeout', '30']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const [rec] = lines();
    assert.equal(rec.box, 'v3');
    assert.match(r.stdout, new RegExp(`job=${rec.id}`));
    appendFileSync(open, JSON.stringify({ box: 'v3', id: 'deadbeef0000', deadline: future(), misses: 0 }) + '\n');
    await new Promise((res) => setTimeout(res, 6000));   // the clone of /nonexistent fails fast, so the first job is over
    assert.equal(py(env, ['tick']).status, 0);
    const led = readFileSync(ledger, 'utf8');
    assert.match(led, new RegExp(`tier=hf-box box=v3 job=${rec.id} ended=failed`));
    assert.match(led, /job=deadbeef0000 ended=unknown reason=job lost/);
    assert.equal(lines().length, 0, 'both ended, so the record is empty');
    rn.stop();
    await new Promise((res) => setTimeout(res, 300));
    appendFileSync(open, JSON.stringify({ box: 'v3', id: 'cafe00000000', deadline: future(), misses: 0 }) + '\n');
    py(env, ['tick']);
    assert.equal(lines().length, 1, 'one miss: kept');
    py(env, ['tick']);
    assert.match(readFileSync(ledger, 'utf8').trim().split('\n').pop()!, /job=cafe00000000 ended=unknown reason=box stopped answering/);
    assert.equal(lines().length, 0);
  } finally { rn.stop(); fx.done(); }
});

test('the default runner only takes plain public github https repos and 40-hex shas', async () => {
  const fx = fixture(), port = await freePort();
  const child = spawn('node', [runner], { env: { ...process.env, PORT: String(port), HFBOX_INNER: inner, HFBOX_LOGDIR: join(fx.dir, 'l'), HFBOX_WORK: join(fx.dir, 'w') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 100)); }
    const post = async (b: object) => fetch(`http://127.0.0.1:${port}/run`, { method: 'POST', body: JSON.stringify(b) });
    const good = { repo: 'https://github.com/a/b.git', sha: 'a'.repeat(40), argv_b64: 'AA==', timeout: 1 };
    assert.equal((await post({ ...good, repo: 'file:///etc' })).status, 400);
    assert.equal((await post({ ...good, repo: 'https://github.com/a/b.git;rm -rf /' })).status, 400);
    assert.equal((await post({ ...good, sha: 'main' })).status, 400);
    assert.equal((await post({ ...good, argv_b64: '$(id)' })).status, 400);
  } finally { child.kill(); fx.done(); }
});

test('list shows each box stage with its cost; only awake boxes cost; a missing Space reads ABSENT; pause calls the Hub', () => {
  const fx = fixture();
  try {
    const r = py({ ...fx.env, STUB_STAGE: 'RUNNING', STUB_MISSING: 'Domlynch/box-v1' }, ['list']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /v3 +Domlynch\/box-v3 +RUNNING +15m +0\.72 +Frankendom v3 Dev/);
    assert.match(r.stdout, /v1 +Domlynch\/box-v1 +ABSENT +- +0\.00/);
    assert.match(r.stdout, /awake cost if left running 24h: \$2\.88\/day/);
    const sleeping = py({ ...fx.env, STUB_STAGE: 'SLEEPING' }, ['list']);
    assert.match(sleeping.stdout, /awake cost if left running 24h: \$0\.00\/day/);
    const p = py(fx.env, ['pause', 'opentrident']);
    assert.match(p.stdout, /box=opentrident space=Domlynch\/box-opentrident paused/);
    assert.ok(fx.calls().some((x) => x[0] === 'pause' && x[1] === 'Domlynch/box-opentrident'));
  } finally { fx.done(); }
});

test('spill pick: the repo\'s box only when Jobs would queue (jobsConcurrent active), a Job otherwise, and always says why', () => {
  const fx = fixture();
  try {
    const queued = py({ ...fx.env, STUB_JOBS: 'RUNNING,SCHEDULING,COMPLETED,ERROR' }, ['pick', 'domlynch/frankendom-v3']);
    assert.equal(queued.stdout.trim(), 'v3');
    assert.match(queued.stderr, /2 Job\(s\) active \(>= 2\) so a Job would queue; using box v3/);
    const free = py({ ...fx.env, STUB_JOBS: 'RUNNING,COMPLETED' }, ['pick', 'DomLynch/Frankendom-v3']);
    assert.equal(free.stdout.trim(), '');
    assert.match(free.stderr, /1 Job\(s\) active \(< 2\); using a Job/);
    const none = py({ ...fx.env, STUB_JOBS: 'RUNNING,RUNNING,RUNNING' }, ['pick', 'acme/unknown']);
    assert.equal(none.stdout.trim(), '');
    assert.match(none.stderr, /no box owns acme\/unknown; using a Job/);
    const second = py({ ...fx.env, STUB_JOBS: 'RUNNING,RUNNING' }, ['pick', 'DomLynch/opentrident-steam']);
    assert.equal(second.stdout.trim(), 'opentrident');
  } finally { fx.done(); }
});

test('hfjob --spill: lands on the repo\'s box when Jobs would queue, on a Job when they would not or the repo has no box', () => {
  const fx = fixture(), w = join(fx.dir, 'w'), g = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  try {
    execFileSync('git', ['init', '-q', w]); writeFileSync(join(w, 'f'), 'x');
    execFileSync('git', ['add', 'f'], { cwd: w, env: g }); execFileSync('git', ['commit', '-q', '-m', 'x'], { cwd: w, env: g });
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: w });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/DomLynch/physics.git'], { cwd: w });
    const run = (jobs: string) => spawnSync('bash', [hfjob, '--spill', '--timeout', '45m', '--', 'true'], { cwd: w, env: { ...fx.env, HFJOB_DRY: '1', STUB_JOBS: jobs }, encoding: 'utf8' });
    const q = run('RUNNING,SCHEDULING');
    assert.equal(q.status, 0, q.stderr);
    assert.match(q.stdout, /^box run Domlynch\/box-physics: /);
    assert.match(run('RUNNING').stdout, /jobs run --detach --timeout 45m /);
    execFileSync('git', ['remote', 'set-url', 'origin', 'https://github.com/acme/other.git'], { cwd: w });
    assert.match(run('RUNNING,SCHEDULING').stdout, /jobs run --detach /);
  } finally { fx.done(); }
});

test('hfjob --box: dry run carries this checkout\'s origin and HEAD to the box payload; --timeout becomes seconds; an unknown box exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfbox-sh-')), w = join(dir, 'w'), env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  try {
    execFileSync('git', ['init', '-q', w]); writeFileSync(join(w, 'f'), 'x');
    execFileSync('git', ['add', 'f'], { cwd: w, env }); execFileSync('git', ['commit', '-q', '-m', 'x'], { cwd: w, env });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:acme/physics.git'], { cwd: w });
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: w });
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: w, encoding: 'utf8' }).trim();
    const r = spawnSync('bash', [hfjob, '--box', 'physics', '--timeout', '2h', '--', 'npm', 'test'], { cwd: w, env: { ...process.env, HFJOB_DRY: '1' }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^box run Domlynch\/box-physics: /);
    const payload = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    assert.deepEqual([payload.repo, payload.sha, payload.timeout, payload.depth], ['https://github.com/acme/physics.git', sha, 7200, 1]);
    assert.equal(Buffer.from(payload.argv_b64, 'base64').toString().trim(), 'npm test');
    const bad = spawnSync('bash', [hfjob, '--box', 'nope', '--', 'true'], { cwd: w, env: { ...process.env, HFJOB_DRY: '1' }, encoding: 'utf8' });
    assert.equal(bad.status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
