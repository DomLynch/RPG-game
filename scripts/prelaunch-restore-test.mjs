// Restore proof for the R1 backup (ops/prelaunch-backup.sh): builds a SCRATCH PostgreSQL cluster (socket-only, disposable) with every repo migration applied, restores the dump into
// it (data only, triggers disabled for the load, as the recovery path would), and compares each table's row count and content hash with the manifest taken from the source.
//   node scripts/prelaunch-restore-test.mjs <r1-...dump> <r1-...manifest.tsv>      env: PG_BIN. Run as a non-root user (as `postgres` on the VPS).
// Exit 0 and "restore proven" only if every table matches. It touches no hosted database; the dump is read, never modified.
// `restoreInto` is exported for scripts/prelaunch-reset-check.mjs, which also restores into the emptied database (the recovery drill).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const pg = name => (process.env.PG_BIN ? join(process.env.PG_BIN, name) : name);
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';

export const parseManifest = file => readFileSync(file, 'utf8').trim().split('\n').map(l => { const [table, n, hash] = l.split('\t'); return { table, n: Number(n), hash }; });

/** The same count and hash the backup script takes, against a cluster whose socket dir is `socket`. */
export function measure(socket, tables) {
  const psql = sql => run('psql', ['-h', socket, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t', '-F', '\t'], sql).trim();
  const sql = tables.map(t => `select '${t}', count(*), coalesce(md5(string_agg(x::text, E'\\n' order by x::text)), 'empty') from public.${t} x;`).join(' ');
  return psql(`begin isolation level repeatable read read only; set local time zone 'UTC'; set local datestyle = 'ISO, MDY'; ${sql} commit;`).split('\n').map(l => { const [table, n, hash] = l.split('\t'); return { table, n: Number(n), hash }; });
}

/** pg_restore of a data-only dump into the cluster at `socket`, triggers disabled for the load (the append-only and conservation triggers must not fire on restored history). */
export const restoreInto = (socket, dump) => run('pg_restore', ['-h', socket, '-d', 'postgres', '-a', '--disable-triggers', '--no-owner', '--exit-on-error', dump]);

/** A disposable cluster with the repo's migrations applied; returns { socket, stop }. */
export function scratchCluster(prefix = 'frankendom-r1-restore-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']);
  const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
  psql(`create extension if not exists pgcrypto; create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for (const n of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) psql(readFileSync(join(dir, n), 'utf8'));
  return { socket: root, psql, stop: () => { try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* disposable */ } rmSync(root, { recursive: true, force: true }); } };
}

export function compare(want, got) {
  const bad = [];
  for (const w of want) { const g = got.find(x => x.table === w.table); if (!g || g.n !== w.n || g.hash !== w.hash) bad.push(`${w.table}: manifest ${w.n} rows ${w.hash.slice(0, 10)}, restored ${g ? `${g.n} rows ${g.hash.slice(0, 10)}` : 'missing'}`); }
  return bad;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [dump, manifest] = process.argv.slice(2);
  if (!dump || !manifest) { console.error('usage: node scripts/prelaunch-restore-test.mjs <dump> <manifest.tsv>'); process.exit(2); }
  const want = parseManifest(manifest);
  const scratch = scratchCluster();
  try {
    restoreInto(scratch.socket, dump);
    const bad = compare(want, measure(scratch.socket, want.map(w => w.table)));
    for (const w of want) console.log(`  ${w.table.padEnd(28)} ${String(w.n).padStart(6)} rows  ${bad.some(b => b.startsWith(`${w.table}:`)) ? 'MISMATCH' : 'ok'}`);
    if (bad.length) { console.error(`restore NOT proven:\n${bad.join('\n')}`); process.exitCode = 1; } else console.log(`restore proven: ${want.length} tables, ${want.reduce((s, w) => s + w.n, 0)} rows, counts and content hashes equal the manifest`);
  } catch (e) { console.error(`restore test FAIL: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`); process.exitCode = 1; } finally { scratch.stop(); }
}
