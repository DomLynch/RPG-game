// Up/down rehearsal and checks for the Origins spend migration (202610060002) on a disposable PostgreSQL cluster, on top of 202610060001: probes before, apply, the new
// event kinds and the one-event read exercised as the writer role, down-script (refused while a burn event exists, clean after the account purge), probes identical
// to before, twice. Socket-only cluster: no DATABASE_URL, no SUPABASE_*, no hosted project is reachable.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const BASE = '202610060001_origins_save.sql', UP = '202610060002_origins_spend.sql';
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
    insert into auth.users values ('${A}'), ('${B}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP) || !files.includes(BASE)) fail(`${BASE} and ${UP} must both be in ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  const down = () => psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  apply(files.filter(n => n < UP));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${A}','Aldren',4,'{"owned":[],"equipped":{}}');`);
  const before = { objects: objects(), acls: acls(), ri: riTriggers(), kinds: psql(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'origins_events_kind_check'`) };
  const same = what => { eq(objects(), before.objects, `${what}: objects and roles`); eq(acls(), before.acls, `${what}: privileges, policies and triggers on every non-origins object`); eq(riTriggers(), before.ri, `${what}: internal triggers`); eq(psql(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'origins_events_kind_check'`), before.kinds, `${what}: the kind check is the original`); };

  apply([UP]);
  eq(W(`select public.origins_event('${A}', 'nope') is null;`).split('\n').pop(), 't', 'up #1: an unknown event reads as null');
  refused('up #1: the function is not callable by a client', 'permission denied', () => client(A, `select public.origins_event('${A}', 'x');`));
  down(); same('down #1');

  apply([UP]);
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}');`);
  const pc = W(`select public.origins_create_character('${A}', 'Aldren');`).split('\n').pop();
  for (const kind of ['burn', 'upgrade']) {
    W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: `${kind}:${pc}:op1`, kind, account: A, character: pc, payload: { owner: pc, lines: [{ item: 'iron-ore', n: 2 }] } }])});`);
    const stored = JSON.parse(W(`select public.origins_event('${A}', '${kind}:${pc}:op1')::text;`).split('\n').pop());
    eq([stored.kind, stored.payload.lines[0].item, stored.payload.lines[0].n], [kind, 'iron-ore', 2], `${kind}: the stored payload reads back`);
    refused(`${kind}: a replay aborts as already settled`, 'already settled', () => W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: `${kind}:${pc}:op1`, kind, account: A, character: pc, payload: {} }])});`));
    eq(W(`select public.origins_event('${B}', '${kind}:${pc}:op1') is null;`).split('\n').pop(), 't', `${kind}: another account reads null, same as an unknown id`);
  }
  // unpaid quest rewards: listed until a paid:<event> is booked; account-scoped
  W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: `quest:${pc}:q1:s2`, kind: 'quest-stage', account: A, character: pc, payload: { stage: 's2', unpaid: ['loot'] } }, { op: 'event', event_id: `quest:${pc}:q1:s3`, kind: 'quest-stage', account: A, character: pc, payload: { stage: 's3', unpaid: [] } }])});`);
  eq(W(`select event_id from public.origins_unpaid('${A}');`).split('\n').filter(Boolean), [`quest:${pc}:q1:s2`], 'unpaid: only the stage with unpaid lines is listed');
  eq(W(`select count(*) from public.origins_unpaid('${B}');`).split('\n').pop(), '0', 'unpaid: another account sees none');
  refused('unpaid: not callable by a client', 'permission denied', () => client(A, `select * from public.origins_unpaid('${A}');`));
  W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: `paid:quest:${pc}:q1:s2`, kind: 'paid', account: A, character: pc, payload: { lines: ['loot'] } }])});`);
  eq(W(`select count(*) from public.origins_unpaid('${A}');`).split('\n').pop(), '0', 'unpaid: a paid:<event> takes it off the list');
  // the paid marker must be the SAME account's and kind 'paid': a trade batch carries two accounts, and another kind under paid:<id> is not a settlement
  W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: `quest:${pc}:q1:s9`, kind: 'quest-stage', account: A, character: pc, payload: { stage: 's9', unpaid: ['standing'] } }])});`);
  W(`select public.origins_commit('${B}', ${J([{ op: 'event', event_id: `paid:quest:${pc}:q1:s9`, kind: 'paid', account: B, payload: {} }])});`);
  eq(W(`select event_id from public.origins_unpaid('${A}');`).split('\n').filter(Boolean), [`quest:${pc}:q1:s9`], "unpaid: another account's paid:<id> row does not clear it");
  W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: `quest:${pc}:q1:s8`, kind: 'quest-stage', account: A, character: pc, payload: { stage: 's8', unpaid: ['loot'] } }, { op: 'event', event_id: `paid:quest:${pc}:q1:s8`, kind: 'burn', account: A, character: pc, payload: {} }])});`);
  eq(W(`select event_id from public.origins_unpaid('${A}');`).split('\n').filter(Boolean), [`quest:${pc}:q1:s9`, `quest:${pc}:q1:s8`], 'unpaid: a paid:<id> row of another kind does not clear it');
  refused('an unknown kind is still refused', 'origins_events_kind_check', () => W(`select public.origins_commit('${A}', ${J([{ op: 'event', event_id: 'coin:x', kind: 'coin', account: A, payload: {} }])});`));
  psql(`update public.origins_config set value = 'false'::jsonb where key = 'origins_enabled';`);
  eq(W(`select public.origins_event('${A}', 'burn:${pc}:op1') is null;`).split('\n').pop(), 't', 'flag off: the read answers null');
  refused('down is refused while a spend event exists (append-only, loud)', 'origins_events_kind_check', () => down());
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled';`);
  W(`select public.origins_purge_account('${A}');`);
  W(`select public.origins_purge_account('${B}');`);
  psql(`update public.origins_config set value = 'false'::jsonb where key = 'origins_enabled'; delete from public.origins_config where false;`);
  down(); psql(`delete from public.origins_access;`);
  eq(psql(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'origins_events_kind_check'`), before.kinds, 'down #2: the kind check is the original');
  eq(objects(), before.objects, 'down #2: objects and roles');
  console.log(`origins-spend-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
