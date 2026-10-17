// Restore proof for the R1 backup (ops/prelaunch-backup.sh): builds a SCRATCH PostgreSQL cluster (socket-only, disposable) with every repo migration applied, loads the backup's CSVs into
// it (data only, the owner's USER triggers switched off for the load transaction, as the recovery path would, so the append-only and conservation triggers do not fire on restored history), and compares
// each table's row count and content hash with the manifest taken from the source.
//   node scripts/prelaunch-restore-test.mjs <r1-... backup directory>      env: PG_BIN. Run as a non-root user (as `postgres` on the VPS).
// Exit 0 and "restore proven" only if every table matches. It touches no hosted database; the backup is read, never modified.
// `restoreInto` is exported for scripts/prelaunch-reset-check.mjs, which also restores into the emptied database (the recovery drill, through ops/prelaunch-restore.sh, the real restore path).
//   node scripts/prelaunch-restore-test.mjs --sql <backup directory>   prints the restore script that ops/prelaunch-restore.sh runs against the real database.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  const sql = tables.map(t => `select '${t}', count(*), coalesce(md5(string_agg(to_jsonb(x)::text, E'\\n' order by to_jsonb(x)::text collate "C")), 'empty') from public.${t} x;`).join(' ');   // jsonb: keys sorted, independent of the physical column order; collate "C": independent of the text collation
  return psql(`begin isolation level repeatable read read only; set local time zone 'UTC'; set local datestyle = 'ISO, MDY'; ${sql} commit;`).split('\n').map(l => { const [table, n, hash] = l.split('\t'); return { table, n: Number(n), hash }; });
}

/**
 * The restore as one psql script (run with psql -f / stdin, because of \copy): ONE transaction, so a failure leaves nothing half-loaded. It needs NO superuser right (production's role may
 * not set session_replication_role, probe 2026-10-17): as the OWNER of the tables it switches off their USER triggers (the append-only and conservation triggers must not fire on restored
 * history) for this transaction only and switches them back on before COMMIT; foreign-key checks stay on, so the tables load parents first. It refuses a target that is not empty (a restore
 * never merges into live rows); data only, the column list read from each CSV's header; then every identity/serial sequence of the restored tables is advanced to max(column), because COPY
 * does not touch sequences and the next ledger write would otherwise collide with a restored id. The same text runs against the scratch cluster (restoreInto) and, through
 * ops/prelaunch-restore.sh, against the real database.
 */
export function restoreSql(backupDir, edges = []) {
  const base = resolve(backupDir), tables = loadOrder(parseManifest(join(base, 'manifest.tsv')).map(m => m.table), edges);
  const list = `array[${tables.map(t => `'${t}'`).join(', ')}]`;
  const lines = [
    'begin;',
    "set local lock_timeout = '15s';",
    ...tables.map(t => `alter table public.${t} disable trigger user;`),
    `do $$ declare t text; n bigint; begin foreach t in array ${list} loop execute format('select count(*) from public.%I', t) into n; if n <> 0 then raise exception 'restore target is not empty: % has % rows', t, n; end if; end loop; end $$;`,
  ];
  for (const t of tables) {
    // The CSV header names the columns (the backup leaves out GENERATED ALWAYS AS (...) STORED columns: the database recomputes them, and the content hash proves them equal).
    const header = readFileSync(join(base, `${t}.csv`), 'utf8').split('\n', 1)[0];
    lines.push(`\\copy public.${t} (${header}) from '${join(base, `${t}.csv`)}' with (format csv, header true)`);
  }
  lines.push(`do $$ declare r record; begin
    for r in select t.t as tbl, a.attname as col, pg_get_serial_sequence(format('public.%I', t.t), a.attname) as seq
        from unnest(${list}) as t(t) join pg_attribute a on a.attrelid = format('public.%I', t.t)::regclass and a.attnum > 0 and not a.attisdropped
        where pg_get_serial_sequence(format('public.%I', t.t), a.attname) is not null
    loop execute format('select setval(%L, coalesce(max(%I), 1), max(%I) is not null) from public.%I', r.seq, r.col, r.col, r.tbl); end loop;
  end $$;`);
  lines.push(...tables.map(t => `alter table public.${t} enable trigger user;`));
  lines.push('commit;');
  return `${lines.join('\n')}\n`;
}

/** The foreign keys between public tables as "child<TAB>parent" lines: the restore loads parents first (FK checks stay on). */
export const FK_EDGES_SQL = `select cl.relname || E'\\t' || pf.relname from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_class pf on pf.oid = c.confrelid
  where c.contype = 'f' and cl.relnamespace = 'public'::regnamespace and pf.relnamespace = 'public'::regnamespace order by 1;`;
export const parseEdges = text => text.split('\n').filter(Boolean).map(l => { const [child, parent] = l.split('\t'); return { child, parent }; });

/** Parents before children; throws on a cycle or a self-reference (a plain COPY cannot load either in order). Tables outside the list are ignored. */
export function loadOrder(tables, edges) {
  const inList = new Set(tables), deps = new Map(tables.map(t => [t, new Set()]));
  for (const { child, parent } of edges) {
    if (!inList.has(child) || !inList.has(parent)) continue;
    if (child === parent) throw Error(`${child} references itself: a plain COPY cannot load it in order`);
    deps.get(child).add(parent);
  }
  const order = [];
  while (order.length < tables.length) {
    const next = tables.find(t => !order.includes(t) && [...deps.get(t)].every(d => order.includes(d)));
    if (!next) throw Error(`foreign keys form a cycle among ${tables.filter(t => !order.includes(t)).join(', ')}`);
    order.push(next);
  }
  return order;
}

/** Load a backup directory's CSVs into the cluster at `socket` (restoreSql above), as `user` when given (a non-superuser owner in the rehearsal). */
export function restoreInto(socket, backupDir, user) {
  const args = ['-h', socket, ...(user ? ['-U', user] : []), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q'];
  const edges = parseEdges(run('psql', [...args, '-A', '-t'], FK_EDGES_SQL));
  return run('psql', args, restoreSql(backupDir, edges));
}

/** A disposable cluster with the repo's migrations applied; returns { socket, psql, stop }. */
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
  if (process.argv[2] === '--sql') {   // the restore script for ops/prelaunch-restore.sh: print it, touch nothing
    if (!process.argv[3]) { console.error('usage: node scripts/prelaunch-restore-test.mjs --sql <r1-... backup directory> [foreign-key edges file: "child<TAB>parent" lines]'); process.exit(2); }
    process.stdout.write(restoreSql(process.argv[3], process.argv[4] ? parseEdges(readFileSync(process.argv[4], 'utf8')) : [])); process.exit(0);
  }
  const backupDir = process.argv[2];
  if (!backupDir) { console.error('usage: node scripts/prelaunch-restore-test.mjs <r1-... backup directory>'); process.exit(2); }
  const want = parseManifest(join(backupDir, 'manifest.tsv'));
  const scratch = scratchCluster();
  try {
    restoreInto(scratch.socket, backupDir);
    const bad = compare(want, measure(scratch.socket, want.map(w => w.table)));
    for (const w of want) console.log(`  ${w.table.padEnd(28)} ${String(w.n).padStart(6)} rows  ${bad.some(b => b.startsWith(`${w.table}:`)) ? 'MISMATCH' : 'ok'}`);
    if (bad.length) { console.error(`restore NOT proven:\n${bad.join('\n')}`); process.exitCode = 1; } else console.log(`restore proven: ${want.length} tables, ${want.reduce((s, w) => s + w.n, 0)} rows, counts and content hashes equal the manifest`);
  } catch (e) { console.error(`restore test FAIL: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`); process.exitCode = 1; } finally { scratch.stop(); }
}
