// The writer's one door to Postgres: psql over a pipe, as the frankendom_origins role (DATABASE_URL, never in git). The SQL goes in on stdin and every
// value goes in as a psql variable (`:'name'`), so nothing a client sent is ever spliced into a statement. No driver dependency, like scripts/verify-loot.mjs.
import { spawn } from 'node:child_process';

export type Db = { run(sql: string, vars?: Readonly<Record<string, string>>): Promise<string> };

// The database's own refusals carry an Oxxxx code (migration 202610060001): 0001 already settled, 0002 stale, 0007 not open, 0008 cap.
export class DbError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const CODE = /ERROR:\s+(O\d{4}|[0-9A-Z]{5}):\s*(.*)/;

export function psqlDb(url: string, bin = 'psql', timeoutMs = 30_000): Db {
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
