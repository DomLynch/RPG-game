// Up/down rehearsal and checks for the Origins bound-metal migration (202610070007: balance + ledger tables, conservation, the `metal` op in origins_apply) on a
// disposable PostgreSQL cluster on top of every earlier migration: apply, attack as the writer role, down-script, probes identical to before.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610070007_origins_metal.sql';
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
const open = (container, a, b) => W(`select public.origins_open_trade('${container}', '${a}', '${b}');`);
const change = (container, character, version, ops) => W(`select public.origins_change_offer('${container}', '${character}', ${version}, ${J(ops)})::text;`);
const accept = (container, character, version, on = true) => W(`select public.origins_accept_trade('${container}', '${character}', ${version}, ${on});`);
const settle = (container, version, ops) => W(`select public.origins_settle_trade('${container}', ${version}, ${J(ops)})::text;`);
const cancel = (container, why, ops) => W(`select public.origins_cancel_trade('${container}', '${why}', ${J(ops)})::text;`);
const esc = (container, from) => ({ kind: 'trade-escrow', container, from });
const put = (id, version, to) => ({ op: 'put', id, expected_version: version, loc: to });
const ev = (kind, account, id) => ({ op: 'event', event_id: id, kind, account, payload: {} });
const tradeRow = c => psql(`select offer_version || '|' || state || '|' || coalesce(accepted_version_a::text, '-') || '|' || coalesce(accepted_version_b::text, '-') || '|' || coalesce(cancel_reason, '-') from public.origins_trades where container = '${c}'`);
const escrowIds = c => psql(`select id from public.origins_items where retired_at is null and loc_kind = 'trade-escrow' and loc_container = '${c}' order by id`).split('\n').filter(Boolean);
const ver = id => Number(psql(`select version from public.origins_items where id = '${id}'`));
const fnDefs = () => psql(`select p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('origins_open_trade', 'origins_settle_trade', 'origins_cancel_trade') order by 1`);
const oneIdx = () => psql(`select coalesce(string_agg(indexdef, ' ; '), 'none') from pg_indexes where indexname = 'origins_items_one_of_each'`);
const kindCheck = () => psql(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'origins_events_kind_check'`);
const tradeCols = () => psql(`select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'origins_trades'`);
const psqlAsync = sql => new Promise(resolve => {
  const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], { env });
  let err = ''; child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, err }));
  child.stdin.end(sql);
});
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key, created_at timestamptz not null default now() - interval '10 days');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${N}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  const down = (up = UP) => psql(readFileSync(join(dir, '..', 'down', up.replace('.sql', '_down.sql')), 'utf8'));
  apply(files.filter(n => n < UP));
  const before = { objects: objects(), acls: acls(), ri: riTriggers(), fns: fnDefs(), idx: oneIdx(), kinds: kindCheck(), cols: tradeCols() };
  const same = what => {
    eq(objects(), before.objects, `${what}: objects and roles`); eq(acls(), before.acls, `${what}: privileges, policies and triggers on every non-origins object`);
    eq(riTriggers(), before.ri, `${what}: internal triggers`); eq(fnDefs(), before.fns, `${what}: open/settle/cancel are 0001's bodies again`);
    eq(oneIdx(), before.idx, `${what}: the one-of-each unique index is back`); eq(kindCheck(), before.kinds, `${what}: the kind check is 0002's`); eq(tradeCols(), before.cols, `${what}: origins_trades has its 0001 columns`);
  };

  const fnText = name => psql(`select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '${name}'`);
  const oldApply = fnText('origins_apply'), oldPurge = fnText('origins_purge_account');
  const bal = a => psql(`select coalesce((select bronze || '/' || version from public.origins_metal where account = '${a}'), 'none') || '|' || (select count(*) from public.origins_metal_ledger where account = '${a}')`);
  const metal = (account, delta, reason, extra = {}) => ({ op: 'metal', account, delta_bronze: delta, reason, event_id: `m:${reason}:${delta}:${extra.expected_version ?? 0}`, ...extra });

  // ---- round 1: up, structure, the one-branch proof, down -----------------------------------------------------------------------
  apply([UP]);
  eq(psql(`select count(*) from pg_class where relname in ('origins_metal', 'origins_metal_ledger') and relrowsecurity`), '2', 'both metal tables have RLS on');
  for (const t of ['origins_metal', 'origins_metal_ledger']) eq(psql(`select has_table_privilege('anon', 'public.${t}', 'select')::int::text || has_table_privilege('authenticated', 'public.${t}', 'insert')::int::text || has_table_privilege('frankendom_origins', 'public.${t}', 'select')::int::text`), '000', `${t}: no anon read, no client write, and the writer role has no direct table access (only the functions)`);
  // origins_apply is 0001's text with ONE new branch and one new declared variable: every other line is byte-identical, in order.
  {
    const newApply = fnText('origins_apply'), a = oldApply.split('\n'), b = newApply.split('\n');
    let i = 0, j = 0; const added = [], removed = [];
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; continue; }
      const k = b.indexOf(a[i], j);   // the next old line reappearing later in the new text: everything before it is added
      if (i < a.length && k !== -1) { while (j < k) added.push(b[j++]); continue; }
      if (i < a.length) removed.push(a[i++]); else added.push(b[j++]);
    }
    eq(removed.length, 1, 'exactly one old line differs (the declare line)');
    eq(removed[0].startsWith('declare op jsonb;') && added[0].startsWith('declare op jsonb;') && added[0].endsWith('delta bigint;'), true, 'and it only gained `delta bigint;`');
    const branch = added.slice(1);
    eq(branch[0].includes("elsif kind = 'metal' then") && branch.length === 13 && branch.every(l => /metal|delta|acct|cnt|else|end if|if |insert|update|get diagnostics|raise|\(op/.test(l)), true, `the rest is one contiguous 13-line metal branch (${branch.length} lines)`);
    eq(b.indexOf(branch[0]) > 0 && b[b.indexOf(branch[0]) + branch.length].includes("elsif kind = 'career_set' then"), true, 'placed right before career_set');
  }
  down(); same('down #1');
  eq(fnText('origins_apply'), oldApply, 'down #1: origins_apply is 0001 byte for byte'); eq(fnText('origins_purge_account'), oldPurge, 'down #1: purge is 0005 byte for byte');

  // ---- round 2: the op, attacked as the writer role ----------------------------------------------------------------------------------
  apply([UP]);
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}'), ('${C}');`);
  const pcA = W(`select public.origins_create_character('${A}', 'Aria');`).split('\n').pop(), pcB = W(`select public.origins_create_character('${B}', 'Bran');`).split('\n').pop();
  eq(bal(A), 'none|0', 'no metal row until the first award');
  commit(A, [metal(A, 100, 'award')]);
  eq(bal(A), '100/1|1', 'the first award creates the row at version 1 and books the ledger');
  commit(A, [metal(A, 50, 'refund', { expected_version: 1 })]);
  eq(bal(A), '150/2|2', 'a refund adds at the expected version');
  commit(A, [metal(A, -30, 'spend', { expected_version: 2 })]);
  eq(bal(A), '120/3|3', 'a spend subtracts');
  refused('a stale version', 'stale', () => commit(A, [metal(A, -1, 'spend', { expected_version: 2 })]));
  refused('overdraw', 'origins_metal_bronze_check', () => commit(A, [metal(A, -121, 'spend', { expected_version: 3 })]));
  refused('the 1e9 cap', 'origins_metal_bronze_check', () => commit(A, [metal(A, 1000000000, 'award', { expected_version: 3 })]));
  refused('a first op that spends', 'origins_metal_bronze_check', () => commit(B, [metal(B, -5, 'spend')]));
  refused('a transfer reason does not exist', 'is not valid', () => commit(A, [metal(A, 5, 'transfer', { expected_version: 3 })]));
  refused('a spend with a positive delta', 'is not valid', () => commit(A, [metal(A, 5, 'spend', { expected_version: 3 })]));
  refused('an award with a negative delta', 'is not valid', () => commit(A, [metal(A, -5, 'award', { expected_version: 3 })]));
  refused('a zero delta', 'is not valid', () => commit(A, [metal(A, 0, 'award', { expected_version: 3 })]));
  refused("someone else's account in the batch", 'outside this batch', () => commit(A, [metal(B, 10, 'award')]));
  eq([bal(A), bal(B)], ['120/3|3', 'none|0'], 'every refusal left both balances alone');
  // direct writes cannot break the books (a superuser, so only the triggers stand in the way)
  refused('a balance edit without a ledger line', 'conservation', () => psql(`update public.origins_metal set bronze = bronze + 5 where account = '${A}'`));
  refused('a ledger line without a balance change', 'conservation', () => psql(`insert into public.origins_metal_ledger (account, delta_bronze, reason) values ('${A}', 7, 'award')`));
  refused('the ledger is append-only', 'append-only', () => psql(`update public.origins_metal_ledger set delta_bronze = 1 where account = '${A}'`));
  refused('and cannot be deleted', 'append-only', () => psql(`delete from public.origins_metal_ledger where account = '${A}'`));
  // one transaction with an item burn
  commit(A, [mintOp('it:ore', 'ore', 5, loc('pack', pcA, 0), 'mk:ore')]);
  refused('a batch whose metal op is invalid rolls the item burn back too', 'is not valid', () => commit(A, [{ op: 'burn', id: 'it:ore', expected_version: ver('it:ore'), count: 2 }, metal(A, 5, 'spend', { expected_version: 3 })]));
  iq(`where id = 'it:ore'`, [`it:ore|5|${ver('it:ore')}|pack:${pcA}:0`], 'the burn was undone with it');
  commit(A, [{ op: 'burn', id: 'it:ore', expected_version: ver('it:ore'), count: 2 }, metal(A, -20, 'spend', { expected_version: 3 })]);
  eq([bal(A), psql(`select quantity from public.origins_items where id = 'it:ore'`)], ['100/4|4', '3'], 'an item burn and a metal spend commit together');
  // readers: an account sees only its own row
  commit(B, [metal(B, 9, 'award')]);
  eq(client(A, `select bronze || '/' || version from public.origins_metal;`), '100/4', "a client reads its own balance and not another account's");
  eq(client(A, `select count(*) from public.origins_metal_ledger;`), '4', 'and its own ledger');
  refused('a client cannot write the balance', 'permission denied', () => client(A, `update public.origins_metal set bronze = 999999 where account = '${A}';`));
  refused('a client cannot call the conservation function', 'permission denied', () => client(A, `select public.origins_metal_conserved();`));
  // erasure
  W(`select public.origins_purge_account('${A}');`);
  eq(bal(A), 'none|0', 'the purge takes the metal row and its ledger');
  eq(bal(B), '9/1|1', "and nothing of another account's");
  refused('0007 down is refused while metal exists', 'metal exists', () => down());
  W(`select public.origins_purge_account('${B}');`);
  down(); same('down #2');
  eq(fnText('origins_apply'), oldApply, 'down #2: origins_apply is 0001 byte for byte'); eq(fnText('origins_purge_account'), oldPurge, 'down #2: purge is 0005 byte for byte');
  console.log(`origins-metal-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
