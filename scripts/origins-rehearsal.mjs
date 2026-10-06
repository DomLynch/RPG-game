// Up/down rehearsal of the Origins migration (202610060001) on a disposable PostgreSQL cluster: probes (objects, privileges, internal triggers) before, apply,
// down-script, probes equal to before, RE-APPLY, down again, probes equal again. origins-database-check.mjs proves the invariants and one down; this proves
// the migration can go up, down and up again with nothing left behind. Socket-only cluster: no DATABASE_URL, no SUPABASE_*, no hosted project is reachable.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610060001_origins_save.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const as = (role, user, sql) => {
  try {
    return psql(`select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};\n${sql}\nreset role;`)
      .split('\n').filter(line => line !== '' && !/^[0-9a-f-]{36}$/.test(line)).join('\n');
  } catch (e) { e.message += `\n  while running as ${role}: ${sql.slice(0, 160)}`; throw e; }
};
const W = sql => as('frankendom_origins', null, sql);
const client = (user, sql) => as('authenticated', user, sql);

const E = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', F = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', N = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const refused = (what, needle, fn) => { checks++; try { fn(); } catch (e) { const text = `${e.stderr ?? ''}${e.message}`; if (text.includes(needle)) return; fail(`${what}: refused for the wrong reason (${text.slice(0, 300)})`); } fail(`${what}: was NOT refused`); };
const J = value => `$j$${JSON.stringify(value)}$j$::jsonb`;
const commit = (account, ops) => W(`select public.origins_commit('${account}', ${J(ops)})::text;`);
const items = where => psql(`select id || '|' || quantity || '|' || version || '|' || coalesce(loc_kind || ':' || coalesce(loc_owner, '') || ':' || coalesce(loc_index::text, loc_slot, ''), 'retired') from public.origins_items ${where} order by id;`).split('\n').filter(Boolean).sort();
const iq = (where, want, what) => eq(items(where), [...want].sort(), what);
const loc = (kind, owner, index) => ({ kind, owner, index });
const mintOp = (id, item, quantity, location, key, extra = {}) => ({ op: 'mint', item: { id, item, quantity, mint_key: key, loc: location, provenance: { kind: 'loot', mintKey: key, at: '2026-10-06T00:00:00Z' }, ...extra } });

const objects = () => psql(`select 'T ' || table_name from information_schema.tables where table_schema = 'public'
  union all select 'F ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all select 'R ' || rolname from pg_roles where rolname like 'frankendom_%' order by 1;`);
// Every privilege on every NON-origins object (tables, columns, functions, schema): the migration must leave all of them byte-identical.
const acls = () => psql(`select 'rel ' || c.relname || ' ' || coalesce(c.relacl::text, '-') || ' rls=' || c.relrowsecurity || ' trg=' || c.relhastriggers from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'auth') and c.relkind in ('r', 'v', 'S') and c.relname not like 'origins\\_%'
  union all select 'col ' || attrelid::regclass || '.' || attname || ' ' || attacl::text from pg_attribute where attacl is not null and attrelid::regclass::text not like '%origins\\_%' and attrelid::regclass::text not like 'pg_%'
  union all select 'fn ' || p.oid::regprocedure || ' ' || coalesce(p.proacl::text, '-') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'origins\\_%'
  union all select 'pol ' || tablename || ' ' || policyname || ' ' || coalesce(qual, '') from pg_policies where tablename not like 'origins\\_%'
  union all select 'trg ' || tgrelid::regclass || ' ' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text not like '%origins\\_%' order by 1;`);
// Internal (referential-integrity) triggers on every NON-origins table, with counts: a foreign key from an origins_ table to auth.users adds two of them
// to auth.users (one per ON DELETE / ON UPDATE action). They are the migration's ONLY expected delta on an existing table, and the down-script must remove them.
const riTriggers = () => psql(`select k || ' x' || count(*) from (select n.nspname || '.' || r.relname || ' <- ' || cr.relname || ' ' || t.tgfoid::regproc::text as k from pg_trigger t join pg_constraint c on c.oid = t.tgconstraint join pg_class r on r.oid = t.tgrelid join pg_namespace n on n.oid = r.relnamespace join pg_class cr on cr.oid = c.conrelid where t.tgisinternal and r.relname not like 'origins\\_%') q group by k order by k;`).split('\n').filter(Boolean);
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('${A}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  const down = () => psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  apply(files.filter(n => n < UP));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${A}','Aldren',4,'{"owned":[],"equipped":{}}');`);
  const before = { objects: objects(), acls: acls(), ri: riTriggers(), rows: psql(`select count(*) from public.fighter_profiles`) };
  const same = (what) => { eq(objects(), before.objects, `${what}: objects and roles`); eq(acls(), before.acls, `${what}: privileges, policies and triggers on every non-origins object`); eq(riTriggers(), before.ri, `${what}: internal triggers`); eq(psql(`select count(*) from public.fighter_profiles`), before.rows, `${what}: existing rows`); };
  for (const round of [1, 2]) {
    apply([UP]);
    eq(psql(`select count(*) from information_schema.tables where table_name like 'origins\\_%'`) > '0', true, `up #${round}: the origins tables exist`);
    eq(psql(`select value::text from public.origins_config where key = 'origins_enabled'`), 'false', `up #${round}: the flag is off`);
    eq(psql(`select count(*) from public.origins_access`), '0', `up #${round}: no account is on the allowlist`);
    down();
    same(`down #${round}`);
  }
  console.log(`origins-rehearsal: ${checks} checks passed (up, down, up, down; probes identical to before each time)`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
