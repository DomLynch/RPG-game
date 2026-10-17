// No database secret on a command line (Lead 2026-10-17). `psql <postgres://user:password@host/db>` puts the password in argv, which `ps` shows to every user on the box.
// This turns a connection string into a libpq SERVICE FILE (mode 0600, in a private 0700 directory, removed at exit) and hands back the environment that points psql at it
// (PGSERVICEFILE, PGSERVICE): the same shape as ops/db-backup.sh. psql is then spawned with NO connection argument at all. Pure Node, no dependency, so the writer, the verifiers
// and the checks share one path. One file per distinct URL for the life of the process (the writer's pool reuses it).
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export type PgConn = { readonly serviceFile: string; readonly env: Readonly<Record<string, string>> };

const URL_RE = /^postgres(?:ql)?:\/\/(?:([^:@/]*)(?::([^@/]*))?@)?(\[[^\]]+\]|[^:/?#]*)(?::(\d+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#.*)?$/;
const KEY = /^[a-z_]{1,32}$/;

/** The service-file text for a connection string. Throws (without echoing the string) on a URL it cannot read or a value a service file cannot hold. */
export function serviceFileText(url: string): string {
  const m = URL_RE.exec(url.trim());
  if (!m) throw new Error('pg-service: the connection string is not a postgres:// URL');
  const dec = (s: string | undefined): string | undefined => (s === undefined || s === '' ? undefined : decodeURIComponent(s));
  const host = m[3] ? m[3].replace(/^\[|\]$/g, '') : undefined;
  const fields: [string, string | undefined][] = [['host', host], ['port', m[4]], ['dbname', dec(m[5]?.slice(1))], ['user', dec(m[1])], ['password', dec(m[2])]];
  for (const [k, v] of new URLSearchParams(m[6] ?? '')) {
    if (!KEY.test(k)) throw new Error('pg-service: a connection option has an unreadable name');
    fields.push([k, v]);   // sslmode, host=<socket dir>, options...: a query host replaces the empty authority host
  }
  const out = new Map<string, string>();
  for (const [k, v] of fields) if (v !== undefined && v !== '') out.set(k, v);
  for (const [k, v] of out) if (/[\r\n]/.test(v)) throw new Error(`pg-service: the ${k} value holds a line break`);
  return `[fk]\n${[...out].map(([k, v]) => `${k}=${v}`).join('\n')}\n`;
}

const made = new Map<string, PgConn>();
let dir: string | undefined;
function cleanup(): void { if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* the directory is private and under tmp */ } dir = undefined; made.clear(); } }

/** The service file and psql environment for a connection string. Never throws a message that contains the string. */
export function pgConn(url: string): PgConn {
  const hit = made.get(url);
  if (hit) return hit;
  const text = serviceFileText(url);
  if (!dir) { dir = mkdtempSync(join(tmpdir(), 'fk-pg-')); chmodSync(dir, 0o700); process.once('exit', cleanup); }
  const file = join(dir, `svc-${made.size}.conf`);
  writeFileSync(file, text, { mode: 0o600 });
  chmodSync(file, 0o600);
  const conn: PgConn = { serviceFile: file, env: { PGSERVICEFILE: file, PGSERVICE: 'fk' } };
  made.set(url, conn);
  return conn;
}
