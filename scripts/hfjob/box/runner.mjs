// In-Space runner for a standing HF box (hfjob --box). Private Space: the Hub proxy already demands the owner's token, so this server has no auth of its own and never sees a token.
//   POST /run {repo,sha,depth,argv_b64,timeout} -> {id}   GET /status/<id>   GET /logs/<id>?from=<byte>   POST /cancel/<id>   GET /health   GET /jobs
// Each run clones <repo>@<sha> with inner.sh (the same body hfjob jobs use), logs to a file, and is killed at its timeout. Repos must be plain public github https URLs.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const PORT = Number(process.env.PORT);
const LOGDIR = process.env.HFBOX_LOGDIR ?? '/tmp/box-logs';
const WORK = process.env.HFBOX_WORK ?? '/w';
const INNER = process.env.HFBOX_INNER;
const REPO_RE = new RegExp(process.env.HFBOX_REPO_RE ?? '^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\\.git$');
if (!PORT || !INNER) { console.error('runner: PORT and HFBOX_INNER are required'); process.exit(2); }
mkdirSync(LOGDIR, { recursive: true });

const jobs = new Map();   // id -> { state, exit, child, started, repo, sha, log }
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const pub = (id, j) => ({ id, state: j.state, exit: j.exit, started: j.started, repo: j.repo, sha: j.sha });

function start(body) {
  const { repo, sha, depth = 1, argv_b64: argv, timeout } = body;
  if (typeof repo !== 'string' || !REPO_RE.test(repo)) return { error: 'repo must be a plain public https://github.com/<owner>/<name>.git URL' };
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) return { error: 'sha must be 40 hex chars' };
  if (typeof argv !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(argv)) return { error: 'argv_b64 must be base64' };
  if (!Number.isInteger(depth) || depth < 0 || !Number.isInteger(timeout) || timeout < 1) return { error: 'depth and timeout must be integers' };
  const id = randomBytes(6).toString('hex'), log = join(LOGDIR, `${id}.log`), fd = openSync(log, 'a');
  const env = { ...process.env, HFJOB_REPO: repo, HFJOB_SHA: sha, HFJOB_DEPTH: String(depth), HFJOB_ARGV_B64: argv, HFJOB_WORKDIR: join(WORK, id) };
  const child = spawn('bash', [INNER], { env, stdio: ['ignore', fd, fd], detached: true });
  closeSync(fd);
  const j = { state: 'running', exit: null, child, started: new Date().toISOString(), repo, sha, log };
  jobs.set(id, j);
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } j.state = 'timeout'; }, timeout * 1000);
  child.on('exit', (code, sig) => { clearTimeout(timer); j.exit = code ?? 128; if (j.state === 'running') j.state = code === 0 ? 'done' : sig ? 'cancelled' : 'failed'; });
  return { id };
}

createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), [, op, id] = u.pathname.split('/');
  if (req.method === 'GET' && op === 'health') return json(res, 200, { ok: true, running: [...jobs.values()].filter((j) => j.state === 'running').length });
  if (req.method === 'GET' && op === 'jobs') return json(res, 200, [...jobs].map(([k, j]) => pub(k, j)));
  if (req.method === 'POST' && op === 'run') {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1 << 20) req.destroy(); });
    return req.on('end', () => {
      let body; try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'bad json' }); }
      const r = start(body); json(res, r.error ? 400 : 200, r);
    });
  }
  const j = jobs.get(id);
  if (!j && ['status', 'logs', 'cancel'].includes(op)) return json(res, 404, { error: 'no such job (the box may have slept and lost it)' });
  if (req.method === 'GET' && op === 'status') return json(res, 200, pub(id, j));
  if (req.method === 'POST' && op === 'cancel') { try { process.kill(-j.child.pid, 'SIGTERM'); } catch { /* already gone */ } return json(res, 200, pub(id, j)); }
  if (req.method === 'GET' && op === 'logs') {
    const from = Math.max(0, Number(u.searchParams.get('from') ?? 0) || 0), size = existsSync(j.log) ? statSync(j.log).size : 0;
    res.writeHead(200, { 'content-type': 'text/plain', 'x-job-state': j.state, 'x-job-exit': String(j.exit ?? ''), 'x-next-offset': String(size) });
    if (size <= from) return res.end();
    return createReadStream(j.log, { start: from, end: size - 1 }).pipe(res);
  }
  json(res, 404, { error: 'not found' });
}).listen(PORT, '0.0.0.0', () => console.log(`box runner on ${PORT}`));
