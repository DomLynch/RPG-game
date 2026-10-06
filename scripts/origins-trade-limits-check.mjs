// Up/down rehearsal and checks for the Origins trade-limits migration (202610070005 slice 1: cooldown guard, DB-written trade history, expiry sweep, event kinds, config) on a
// disposable PostgreSQL cluster on top of every earlier migration: apply, attack as the writer role, down-script, probes identical to before.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610070005_origins_trade_limits.sql', UP6 = '202610070006_origins_trade_reversal.sql';
import { TIERS } from '../src/grades.ts';
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
  for (const f of [UP, UP6]) if (!files.includes(f)) fail(`${f} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  const down = (up = UP) => psql(readFileSync(join(dir, '..', 'down', up.replace('.sql', '_down.sql')), 'utf8'));
  apply(files.filter(n => n < UP));
  const before = { objects: objects(), acls: acls(), ri: riTriggers(), fns: fnDefs(), idx: oneIdx(), kinds: kindCheck(), cols: tradeCols() };
  const same = what => {
    eq(objects(), before.objects, `${what}: objects and roles`); eq(acls(), before.acls, `${what}: privileges, policies and triggers on every non-origins object`);
    eq(riTriggers(), before.ri, `${what}: internal triggers`); eq(fnDefs(), before.fns, `${what}: open/settle/cancel are 0001's bodies again`);
    eq(oneIdx(), before.idx, `${what}: the one-of-each unique index is back`); eq(kindCheck(), before.kinds, `${what}: the kind check is 0002's`); eq(tradeCols(), before.cols, `${what}: origins_trades has its 0001 columns`);
  };

  // ---- round 1: up, structure, down ---------------------------------------------------------------------------------------------
  apply([UP]);
  for (const fn of ['origins_trade_cooldown_s(integer)', 'origins_trade_cooldown_guard()', 'origins_trade_history()']) {
    eq(psql(`select has_function_privilege('frankendom_origins', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '000', `${fn} is nobody's to call`);
  }
  eq(psql(`select has_function_privilege('frankendom_origins', 'public.origins_expire_trades()', 'execute')::int::text || has_function_privilege('anon', 'public.origins_expire_trades()', 'execute')::int::text || has_function_privilege('authenticated', 'public.origins_expire_trades()', 'execute')::int::text`), '100', 'only the writer sweeps trades');
  eq(kindCheck(), before.kinds, '0005 alone (class 1) leaves the event kinds as 0003 has them');
  eq(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'origins_reverse_trade'`), '0', '0005 alone has no reversal function (it is 0006)');
  down(); same('down #1');

  // ---- round 2: the cooldown, the DB-written history, the sweep -----------------------------------------------------------------------
  apply([UP, UP6]);
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}'), ('${C}');`);
  const pcA = W(`select public.origins_create_character('${A}', 'Aria');`).split('\n').pop(), pcB = W(`select public.origins_create_character('${B}', 'Bran');`).split('\n').pop();
  const pcC = W(`select public.origins_create_character('${C}', 'Cass');`).split('\n').pop();
  const one = { single_copy: true };
  const at = iso => ({ provenance: { kind: 'loot', mintKey: 'x', at: iso } });
  const old = '2026-01-01T00:00:00Z', fresh = new Date().toISOString();
  commit(A, [mintOp('it:old', 'helm', 1, loc('pack', pcA, 0), 'mk:old', { ...one, ...at(old) }), mintOp('it:new', 'sword', 1, loc('pack', pcA, 1), 'mk:new', { ...one, ...at(fresh) })]);
  commit(B, [mintOp('it:b1', 'cup', 1, loc('pack', pcB, 0), 'mk:b1', { ...one, ...at(old) }), mintOp('it:old2', 'ring', 1, loc('pack', pcB, 6), 'mk:old2', { ...one, ...at(old) })]);
  // test fixtures only: the item guard keeps history append-only and provenance fixed, so rewriting a clock switches it off for the one statement
  const rewrite = sql => psql(`alter table public.origins_items disable trigger origins_item_guard; ${sql}; alter table public.origins_items enable trigger origins_item_guard;`);
  const sorted = o => Object.fromEntries(Object.entries(o).sort());   // jsonb reorders object keys
  const hist = id => psql(`select history::text from public.origins_items where id = '${id}'`);
  const settleSwap = (c, give, take, n) => {
    open(c, pcA, pcB);
    change(c, pcA, 0, [put(give, ver(give), esc(c, pcA))]);
    change(c, pcB, 1, [put(take, ver(take), esc(c, pcB))]);
    accept(c, pcA, 2); accept(c, pcB, 2);
    settle(c, 2, [put(give, ver(give), loc('pack', pcB, n)), put(take, ver(take), loc('pack', pcA, n)), ev('trade', A, `${c}:a`), ev('trade', B, `${c}:b`)]);
  };

  // M9: a fresh piece cannot enter escrow; the first trade waits 72 h after the mint
  open('tr:1', pcA, pcB);
  refused('a piece minted just now is cooling', 'is cooling down', () => change('tr:1', pcA, 0, [put('it:new', ver('it:new'), esc('tr:1', pcA))]));
  eq(escrowIds('tr:1'), [], 'the refused offer left escrow empty');
  refused('even a direct update (guard switch on) cannot put a cooling piece into escrow', 'is cooling down', () => psql(`select set_config('origins.trade','on',false); update public.origins_items set version = version + 1, loc_kind = 'trade-escrow', loc_owner = null, loc_index = null, loc_container = 'tr:1', loc_from = '${pcA}' where id = 'it:new';`));
  // an old piece is offered, swapped; the history entry is written by the DB, not the client
  change('tr:1', pcA, 0, [put('it:old', ver('it:old'), esc('tr:1', pcA))]);
  change('tr:1', pcB, 1, [put('it:b1', ver('it:b1'), esc('tr:1', pcB))]);
  accept('tr:1', pcA, 2); accept('tr:1', pcB, 2);
  settle('tr:1', 2, [put('it:old', ver('it:old'), loc('pack', pcB, 5)), put('it:b1', ver('it:b1'), loc('pack', pcA, 5)), ev('trade', A, 'trade:t1:a'), ev('trade', B, 'trade:t1:b')]);
  eq(JSON.parse(hist('it:old')).map(e => [e.kind, e.trade, e.from, e.to]), [['trade', 'tr:1', pcA, pcB]], 'settle writes the trade entry on the piece that moved to B');
  eq(JSON.parse(hist('it:b1')).map(e => [e.kind, e.trade, e.from, e.to]), [['trade', 'tr:1', pcB, pcA]], 'and on the piece that moved to A');
  eq(hist('it:new'), '[]', 'a piece that never traded has no entry');
  // hop 1: it:old is now with B, cooling again for 7 days from the trade
  open('tr:2', pcB, pcC);
  refused('a piece just traded is cooling again', 'is cooling down', () => change('tr:2', pcB, 0, [put('it:old', ver('it:old'), esc('tr:2', pcB))]));
  const setAt = (id, days) => rewrite(`update public.origins_items set history = (select jsonb_agg(jsonb_set(e, '{at}', to_jsonb((now() - interval '${days} days')::text))) from jsonb_array_elements(history) e) where id = '${id}'`);
  setAt('it:old', 6);
  refused('6 days after the first trade is still inside the 7 day step', 'is cooling down', () => change('tr:2', pcB, 0, [put('it:old', ver('it:old'), esc('tr:2', pcB))]));
  setAt('it:old', 8);
  change('tr:2', pcB, 0, [put('it:old', ver('it:old'), esc('tr:2', pcB))]);
  eq(escrowIds('tr:2'), ['it:old'], '8 days after: offered');
  eq(JSON.parse(hist('it:old')).length, 1, 'entering escrow writes no history');
  // cancel: back to its owner, no entry
  cancel('tr:2', 'cancelled', [put('it:old', ver('it:old'), loc('pack', pcB, 5))]);
  eq(JSON.parse(hist('it:old')).length, 1, 'a cancel returns the piece and writes no trade entry');
  // the step table: 2 hops = 14 days, 3+ = 30 days (the last step repeats)
  const hops = n => JSON.stringify(Array.from({ length: n }, (_, i) => ({ kind: 'trade', trade: `h${i}`, from: pcA, to: pcB, at: new Date(Date.now() - (n - i) * 86400000).toISOString() })));
  eq(psql(`select public.origins_trade_cooldown_s(0) || ',' || public.origins_trade_cooldown_s(1) || ',' || public.origins_trade_cooldown_s(2) || ',' || public.origins_trade_cooldown_s(3) || ',' || public.origins_trade_cooldown_s(9)`), '259200,604800,1209600,2592000,2592000', 'cooldown seconds per hop count; the last step repeats');
  open('tr:3', pcB, pcC);
  const offer = id => change('tr:3', pcB, 0, [put(id, ver(id), esc('tr:3', pcB))]);
  rewrite(`update public.origins_items set history = '${hops(2)}'::jsonb where id = 'it:old2'`); setAt('it:old2', 10);
  refused('two hops: 10 days is inside the 14 day step', 'is cooling down', () => offer('it:old2'));
  setAt('it:old2', 15); offer('it:old2');
  cancel('tr:3', 'cancelled', [put('it:old2', ver('it:old2'), loc('pack', pcB, 6))]);
  open('tr:4', pcB, pcC);
  rewrite(`update public.origins_items set history = '${hops(5)}'::jsonb where id = 'it:old2'`); setAt('it:old2', 20);
  refused('five hops: 20 days is inside the repeating 30 day step', 'is cooling down', () => change('tr:4', pcB, 0, [put('it:old2', ver('it:old2'), esc('tr:4', pcB))]));
  setAt('it:old2', 31); change('tr:4', pcB, 0, [put('it:old2', ver('it:old2'), esc('tr:4', pcB))]);
  cancel('tr:4', 'cancelled', [put('it:old2', ver('it:old2'), loc('pack', pcB, 6))]);
  rewrite(`update public.origins_items set provenance = jsonb_set(provenance, '{at}', 'null'::jsonb), history = '[]'::jsonb where id = 'it:old2'`);
  open('tr:5', pcB, pcC);
  refused('no readable clock fails closed', 'no readable trade clock', () => change('tr:5', pcB, 0, [put('it:old2', ver('it:old2'), esc('tr:5', pcB))]));
  cancel('tr:5', 'cancelled', []);

  // a retirement nulls loc_kind: the cooldown guard must let a burn of a cooling piece through. 0003's escrow guard has the same flaw in prod and blocks every
  // burn until 0004_origins_escrow_guard_null (#1523) is in the migrations folder, so this row runs only once that file is on the base.
  if (files.some(n => n.includes('escrow_guard_null'))) {
    commit(B, [mintOp('it:burn', 'gem', 1, loc('pack', pcB, 9), 'mk:burn', { ...one, ...at(fresh) })]);
    commit(B, [{ op: 'burn', id: 'it:burn', expected_version: ver('it:burn'), count: 1 }]);
    eq(psql(`select count(*) from public.origins_items where id = 'it:burn' and retired_at is not null`), '1', 'a cooling piece can still be burned (null-safe guard)');
  } else console.log('origins-trade-limits-check: burn row SKIPPED (escrow_guard_null not on this base)');

  // M10: the sweep
  eq(psql(`select count(*) from public.origins_expire_trades()`), '0', 'a fresh trade is not swept');
  open('tr:6', pcB, pcC);
  psql(`update public.origins_trades set last_change_at = now() - interval '10 minutes' where container = 'tr:6'`);
  eq(W(`select container || ':' || reason from public.origins_expire_trades() order by container;`), 'tr:6:timeout', 'an idle trade is a timeout');
  cancel('tr:6', 'timeout', []);
  open('tr:7', pcA, pcC);
  psql(`update public.origins_trades set expires_at = now() - interval '1 second' where container = 'tr:7'`);
  eq(W(`select container || ':' || reason from public.origins_expire_trades() order by container;`), 'tr:7:expired', 'a past expires_at is expired');
  cancel('tr:7', 'expired', []);
  eq(psql(`select count(*) from public.origins_expire_trades()`), '0', 'a cancelled trade is not swept again');
  refused('the sweep is not the client\'s', 'permission denied', () => client(A, `select * from public.origins_expire_trades();`));

  // M12: the audit trail
  W(`select public.origins_trade_audit_record('tr:1', '${A}', '${pcA}', 'sess-1', 'dev-1', 'iphash-1', 'safari');`);
  eq(psql(`select container || '|' || account || '|' || device_hash || '|' || ua_family from public.origins_trade_audit`), `tr:1|${A}|dev-1|safari`, 'the writer records an audit row');
  refused('a client cannot record an audit row', 'permission denied', () => client(A, `select public.origins_trade_audit_record('tr:1', '${A}', null, null, null, null, null);`));
  refused('a client cannot read the audit table', 'permission denied', () => client(A, `select * from public.origins_trade_audit;`));
  refused('an over-long device hash is refused', 'origins_trade_audit_device_hash_check', () => W(`select public.origins_trade_audit_record('tr:1', '${A}', null, null, '${'x'.repeat(121)}', null, null);`));
  psql(`insert into public.origins_trade_audit (container, account, at) values ('tr:old', '${A}', now() - interval '100 days')`);
  refused('prune keeps at least one day', 'at least one day', () => W(`select public.origins_trade_audit_prune(0);`));
  eq(W(`select public.origins_trade_audit_prune(90);`), '1', 'prune deletes the 100 day old row only');
  eq(psql(`select count(*) from public.origins_trade_audit`), '1', 'and keeps the fresh one');

  // M13 + M14: the limits reader and the counts
  rewrite(`update public.origins_items set tier = '${TIERS[9]}' where id = 'it:b1'`);
  const lim = JSON.parse(W(`select public.origins_trade_limits('${B}')::text;`));
  eq([lim.gates.min_career_level, lim.gates.account_age_s, lim.caps.open, lim.caps.pieces, lim.caps.origin_tier], [11, 604800, 1, 20, 2], 'the limits carry the configured gates and caps');
  eq(lim.account_age_s >= 864000 && lim.account_age_s < 864100, true, 'account age comes from auth.users.created_at');
  eq(sorted(lim.counts), sorted({ open: 0, settled: 1, counterparties: 1, pieces: 1, origin_tier: 1 }), 'B settled one trade, gave one piece, and it was an origin-tier one');
  eq(sorted(JSON.parse(W(`select public.origins_trade_counts('${C}', now() - interval '24 hours')::text;`))), sorted({ open: 0, settled: 0, counterparties: 0, pieces: 0, origin_tier: 0 }), 'an account that never traded counts zero');
  eq(JSON.parse(W(`select public.origins_trade_counts('${A}', now() + interval '1 hour')::text;`)).settled, 0, 'a window in the future counts nothing');
  // the origin-tier cap counts the CANONICAL title string (src/career.ts TITLES[9] = grades.ts TIERS[9], case-sensitive): Strategy 2026-10-07. The config
  // list must be that constant (drift guard), and an item carrying it increments the cap while a lowercase twin does not.
  eq(JSON.parse(psql(`select value::text from public.origins_config where key = 'trade_caps'`)).origin_tiers, [TIERS[9]], 'origin_tiers is the canonical TIERS[9] string');
  rewrite(`update public.origins_items set tier = '${TIERS[9].toLowerCase()}' where id = 'it:b1'`);
  eq(JSON.parse(W(`select public.origins_trade_counts('${B}', now() - interval '24 hours')::text;`)).origin_tier, 0, 'a lowercase tier does not count as origin-tier');
  rewrite(`update public.origins_items set tier = '${TIERS[9]}' where id = 'it:b1'`);
  eq(JSON.parse(W(`select public.origins_trade_counts('${B}', now() - interval '24 hours')::text;`)).origin_tier, 1, 'the canonical Origin tier counts');
  // a second settled trade with the SAME counterparty: settled and pieces grow, counterparties stays 1 (distinct)
  commit(A, [mintOp('it:x1', 'bracer', 1, loc('pack', pcA, 7), 'mk:x1', { ...one, ...at(old) })]);
  commit(B, [mintOp('it:y1', 'amulet', 1, loc('pack', pcB, 8), 'mk:y1', { ...one, ...at(old) })]);
  settleSwap('tr:8', 'it:x1', 'it:y1', 9);
  eq(sorted(JSON.parse(W(`select public.origins_trade_counts('${B}', now() - interval '24 hours')::text;`))), sorted({ open: 0, settled: 2, counterparties: 1, pieces: 2, origin_tier: 1 }), 'two settled trades with one counterparty: counterparties stays 1');
  refused('the limits are not the client\'s', 'permission denied', () => client(A, `select public.origins_trade_limits('${A}');`));

  // M14: the reversal of tr:1 (it:old went A to B, it:b1 went B to A)
  psql(`insert into auth.users (id) values ('eeeeeeee-0000-4000-8000-000000000001'); insert into public.admins (user_id) values ('eeeeeeee-0000-4000-8000-000000000001');`);
  const ADMIN = 'eeeeeeee-0000-4000-8000-000000000001';
  const rev = (reviewer, reason, ops, container = 'tr:1') => W(`select public.origins_reverse_trade('${container}', '${reviewer}', '${reason}', ${J(ops)})::text;`);
  const back = [put('it:old', ver('it:old'), loc('pack', pcA, 3)), put('it:b1', ver('it:b1'), loc('pack', pcB, 3))];
  refused('a non-admin cannot reverse', 'is not an admin', () => rev(A, 'because', back));
  refused('a reversal needs a reason', 'needs a reason', () => rev(ADMIN, 'x', back));
  refused('an unsettled (cancelled) trade cannot be reversed', 'is not settled', () => rev(ADMIN, 'because', [], 'tr:6'));
  refused('a piece the trade never moved', 'was not moved by trade', () => rev(ADMIN, 'because', [put('it:new', ver('it:new'), loc('pack', pcA, 3))]));
  refused('a piece back to the wrong owner', "goes back to the sender", () => rev(ADMIN, 'because', [put('it:old', ver('it:old'), loc('pack', pcC, 3))]));
  refused('a reversal put with history_append', 'moves a piece only', () => rev(ADMIN, 'because', [{ ...back[0], history_append: [{ kind: 'forged' }] }]));
  refused('only puts', 'not allowed in a reversal', () => rev(ADMIN, 'because', [mintOp('it:x', 'x', 1, loc('pack', pcA, 9), 'mk:x')]));
  eq(items(`where id in ('it:old','it:b1')`), [`it:b1|1|${ver('it:b1')}|pack:${pcA}:5`, `it:old|1|${ver('it:old')}|pack:${pcB}:5`], 'refused reversals moved nothing');
  rev(ADMIN, 'duel-farm proof', back);
  eq(items(`where id in ('it:old','it:b1')`), [`it:b1|1|${ver('it:b1')}|pack:${pcB}:3`, `it:old|1|${ver('it:old')}|pack:${pcA}:3`], 'the pieces are back with their senders');
  eq(JSON.parse(hist('it:old')).map(e => [e.kind, e.trade, e.from, e.to]).at(-1), ['reversal', 'tr:1', pcB, pcA], 'the DB wrote the reversal history entry itself');
  eq(psql(`select count(*) || '|' || min(payload ->> 'reviewer') || '|' || min(payload ->> 'reason') from public.origins_events where kind = 'trade-reversal'`), `2|${ADMIN}|duel-farm proof`, 'a trade-reversal event per side carries reviewer and reason');
  refused('a trade can be reversed once (the event ids are the lock)', 'already settled', () => rev(ADMIN, 'again', []));
  eq(JSON.parse(W(`select public.origins_trade_counts('${B}', now() - interval '24 hours')::text;`)).settled, 2, 'a reversal does not erase the settled trade from the counts');

  // M11: the kinds
  for (const kind of ['trade-reversal', 'trade-hold', 'metal']) psql(`insert into public.origins_events (event_id, kind, account) values ('k:${kind}', '${kind}', '${A}')`);
  refused('an unknown kind is still refused', 'origins_events_kind_check', () => psql(`insert into public.origins_events (event_id, kind, account) values ('k:x', 'bogus', '${A}')`));
  // down: refused while a new-kind event exists (append-only), clean after the purge
  refused('0006 down is refused while a new-kind event exists', 'origins_events_kind_check', () => down(UP6));
  eq(psql(`select count(*) from public.origins_trade_audit where account = '${A}'`), '1', 'A has an audit row before the purge');
  for (const a of [A, B, C]) W(`select public.origins_purge_account('${a}');`);
  eq(psql(`select count(*) from public.origins_trade_audit where account = '${A}'`), '0', 'the purge took the audit rows too');
  down(UP6); down(UP); same('down #2');
  console.log(`origins-trade-limits-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
