// The writer's one door to Postgres: psql over a pipe, as the frankendom_origins role (DATABASE_URL, never in git). The SQL goes in on stdin and every
// value goes in as a psql variable (`:'name'`), so nothing a client sent is ever spliced into a statement. No driver dependency, like scripts/verify-loot.mjs.
// With pool > 0 the psql processes stay up and are reused (a spawn per op was the writer's ceiling, 1.3 per op in the S1 load test); a refusal still kills its process
// (ON_ERROR_STOP on a pipe exits), so the next op gets a fresh session and a half-run script never leaks state into the next op.
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export type Db = { run(sql: string, vars?: Readonly<Record<string, string>>): Promise<string> };

// The database's own refusals carry an Oxxxx code (migration 202610060001): 0001 already settled, 0002 stale, 0007 not open, 0008 cap.
export class DbError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const CODE = /ERROR:\s+(O\d{4}|[0-9A-Z]{5}):\s*(.*)/;

export function psqlDb(url: string, bin = 'psql', timeoutMs = 30_000, pool = 0): Db {
  if (pool > 0) return pooledDb(url, bin, timeoutMs, pool);
  return {
    run: (sql, vars = {}) => new Promise((resolve, reject) => {
      const args = [url, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
      for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
      const child = spawn(bin, [...args, '-f', '-'], { env: { ...process.env, LC_ALL: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '', err = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.stdout.on('data', d => { out += d; });
      child.stderr.on('data', d => { err += d; });
      child.on('error', e => { clearTimeout(timer); reject(e); });
      child.on('close', status => {
        clearTimeout(timer);
        if (status === 0) return resolve(out.trim());
        const m = CODE.exec(err);
        reject(new DbError(m?.[1] ?? 'psql', m?.[2] ?? (err.trim().slice(0, 200) || `psql exit ${status}`)));
      });
      child.stdin.end(sql);
    }),
  };
}

const quote = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
const nonce = randomBytes(12).toString('hex');   // per process: data a client stored cannot spell the end-of-result line
const done = (id: number) => `__origins_done_${nonce}_${id}__`;

type Job = { sql: string; vars: Readonly<Record<string, string>>; resolve: (out: string) => void; reject: (e: Error) => void };
type Worker = { child: ChildProcessWithoutNullStreams; job: Job | null; id: number; out: string; err: string; timer?: NodeJS.Timeout; dead: boolean };

// Each op is: its variables as \set, the script, a trailing `;` (so an unterminated statement still runs, as at the end of `-f -`), a rollback (a script that left a transaction
// open must not hand it to the next op), the variables unset, then a marker line. The result is everything psql printed before the marker.
function pooledDb(url: string, bin: string, timeoutMs: number, size: number): Db {
  const idle: Worker[] = [], all = new Set<Worker>(), queue: Job[] = [];
  let seq = 0;

  // A session holds the process open only while it runs an op (so a test, a load run or a check can exit with idle sessions up; a pending op is never abandoned).
  const hold = (w: Worker, on: boolean) => { const k = on ? 'ref' : 'unref'; w.child[k](); for (const io of [w.child.stdin, w.child.stdout, w.child.stderr]) (io as unknown as { ref(): void; unref(): void })[k](); };

  const finish = (w: Worker, fail?: Error) => {
    clearTimeout(w.timer);
    const job = w.job; w.job = null;
    if (fail) { w.dead = true; all.delete(w); w.child.kill('SIGKILL'); } else { idle.push(w); hold(w, false); }
    if (job) (fail ? job.reject(fail) : job.resolve(w.out.trim()));
    w.out = ''; w.err = '';
    pump();
  };

  const start = (): Worker => {
    const child = spawn(bin, [url, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', '-'], { env: { ...process.env, LC_ALL: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
    const w: Worker = { child, job: null, id: 0, out: '', err: '', dead: false };
    child.stdout.on('data', d => {
      w.out += d;
      const at = w.job ? w.out.indexOf(`\n${done(w.id)}\n`) : -1;
      if (at >= 0) { w.out = w.out.slice(0, at); finish(w); }
    });
    child.stderr.on('data', d => { w.err = (w.err + d).slice(-4000); });
    child.on('error', e => { if (w.job) finish(w, e); else { w.dead = true; all.delete(w); } });
    child.on('close', status => {
      w.dead = true; all.delete(w);
      const at = idle.indexOf(w); if (at >= 0) idle.splice(at, 1);
      if (!w.job) return pump();
      const m = CODE.exec(w.err);
      finish(w, new DbError(m?.[1] ?? 'psql', m?.[2] ?? (w.err.trim().slice(0, 200) || `psql exit ${status}`)));
    });
    child.stdin.on('error', () => { /* the close handler reports it */ });
    hold(w, false);
    all.add(w);
    return w;
  };

  function pump() {
    while (queue.length) {
      const w = idle.pop() ?? (all.size < size ? start() : null);
      if (!w) return;
      if (w.dead) continue;
      const job = queue.shift()!;
      w.job = job; w.id = ++seq; w.out = ''; w.err = ''; hold(w, true);
      w.timer = setTimeout(() => w.child.kill('SIGKILL'), timeoutMs);
      const keys = Object.keys(job.vars);
      w.child.stdin.write(`${keys.map(k => `\\set ${k} ${quote(job.vars[k])}\n`).join('')}${job.sql}\n;\nrollback;\n${keys.map(k => `\\unset ${k}\n`).join('')}\\echo\n\\echo ${done(w.id)}\n`);
    }
  }

  return { run: (sql, vars = {}) => new Promise((resolve, reject) => { queue.push({ sql, vars, resolve, reject }); pump(); }) };
}
