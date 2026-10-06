// Up/down rehearsal and checks for the Origins trade-settle migration (202610060003: acceptance model, escrow guard, settle/cancel checks, deferred one-of-each) on a
// disposable PostgreSQL cluster on top of 0001 + 0002: probes before, apply, every gap attacked as the writer role (and a concurrency race), down-script, probes identical to
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610060003_origins_trade_settle.sql';
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
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('${A}'), ('${B}'), ('${C}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  const down = () => psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  apply(files.filter(n => n < UP));
  const before = { objects: objects(), acls: acls(), ri: riTriggers(), fns: fnDefs(), idx: oneIdx(), kinds: kindCheck(), cols: tradeCols() };
  const same = what => {
    eq(objects(), before.objects, `${what}: objects and roles`); eq(acls(), before.acls, `${what}: privileges, policies and triggers on every non-origins object`);
    eq(riTriggers(), before.ri, `${what}: internal triggers`); eq(fnDefs(), before.fns, `${what}: open/settle/cancel are 0001's bodies again`);
    eq(oneIdx(), before.idx, `${what}: the one-of-each unique index is back`); eq(kindCheck(), before.kinds, `${what}: the kind check is 0002's`); eq(tradeCols(), before.cols, `${what}: origins_trades has its 0001 columns`);
  };

  // ---- round 1: up, structure, down ---------------------------------------------------------------------------------------------
  apply([UP]);
  eq(oneIdx(), 'none', 'up #1: the one-of-each unique index is gone (a deferred trigger counts instead)');
  eq(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'origins_settle_trade' and pg_get_function_identity_arguments(p.oid) = 'p_container text, p_batch jsonb'`), '0', 'up #1: the old two-argument settle is gone');
  eq(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'origins_cancel_trade' and pg_get_function_identity_arguments(p.oid) = 'p_container text, p_batch jsonb'`), '0', 'up #1: the old two-argument cancel is gone');
  for (const fn of ['origins_change_offer(text,text,integer,jsonb)', 'origins_accept_trade(text,text,integer,boolean)', 'origins_settle_trade(text,integer,jsonb)', 'origins_cancel_trade(text,text,jsonb)', 'origins_open_trade(text,text,text)']) {
    eq(psql(`select has_function_privilege('frankendom_origins', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '100', `up #1: ${fn} is the writer's alone`);
  }
  down(); same('down #1');

  // ---- round 2: every gap attacked as the writer role --------------------------------------------------------------------------------
  apply([UP]);
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}'), ('${C}');`);
  const pcA = W(`select public.origins_create_character('${A}', 'Aria');`).split('\n').pop(), pcA2 = W(`select public.origins_create_character('${A}', 'Aria II');`).split('\n').pop();
  const pcB = W(`select public.origins_create_character('${B}', 'Bran');`).split('\n').pop(), pcC = W(`select public.origins_create_character('${C}', 'Cass');`).split('\n').pop();
  const one = { single_copy: true };
  commit(A, [mintOp('it:h0', 'helm', 1, loc('pack', pcA, 0), 'mk:h0', { ...one, upgrade_level: 0 }), mintOp('it:sw', 'sword', 1, loc('pack', pcA, 1), 'mk:sw', one), mintOp('it:ore', 'ore', 5, loc('pack', pcA, 2), 'mk:ore')]);
  commit(B, [mintOp('it:h3', 'helm', 1, loc('pack', pcB, 0), 'mk:h3', { ...one, upgrade_level: 3 }), mintOp('it:bound', 'charm', 1, loc('pack', pcB, 1), 'mk:bound', { ...one, bound_to: 'someone' })]);
  commit(C, [mintOp('it:cup', 'cup', 1, loc('pack', pcC, 0), 'mk:cup', one), mintOp('it:hc', 'helm', 1, loc('pack', pcC, 1), 'mk:hc', { ...one, upgrade_level: 1 })]);

  // M3 / M2: who may open a trade
  refused('a trade between two characters of one account', 'two accounts', () => open('tr:0', pcA, pcA2));
  open('tr:1', pcA, pcB);
  refused('a second trade for an account already trading', 'already in an open trade', () => open('tr:2', pcA2, pcC));
  refused('one open trade per character, also at the index', 'origins_trades_open_side_a', () => psql(`insert into public.origins_trades (container, side_a, side_b) values ('tr:9', '${pcA}', '${pcC}');`));
  eq(tradeRow('tr:1'), '0|open|-|-|-', 'a fresh trade: version 0, nothing accepted');
  // M8: nothing enters or leaves escrow outside the trade functions
  refused('a plain commit cannot put a piece into escrow', 'only inside the trade functions', () => commit(A, [put('it:h0', 1, esc('tr:1', pcA))]));
  // M4: change_offer
  refused('a character that is not a side', 'is not a side', () => change('tr:1', pcC, 0, [put('it:cup', 1, esc('tr:1', pcC))]));
  refused('a stale offer version', 'offer moved', () => change('tr:1', pcA, 5, [put('it:h0', 1, esc('tr:1', pcA))]));
  refused("someone else's piece", "not this side's to offer", () => change('tr:1', pcA, 0, [put('it:h3', 1, esc('tr:1', pcA))]));
  refused('a stackable (not single-copy) cannot be offered', 'cannot be offered', () => change('tr:1', pcA, 0, [put('it:ore', 1, esc('tr:1', pcA))]));
  refused('a bound piece cannot be offered', 'cannot be offered', () => change('tr:1', pcB, 0, [put('it:bound', 1, esc('tr:1', pcB))]));
  refused('offering into another trade', 'only be offered from this character into this trade', () => change('tr:1', pcA, 0, [put('it:h0', 1, esc('tr:7', pcA))]));
  refused('a change of offer is puts only', 'puts only', () => change('tr:1', pcA, 0, [mintOp('it:x', 'x', 1, loc('pack', pcA, 9), 'mk:x')]));
  eq(tradeRow('tr:1'), '0|open|-|-|-', 'refused changes leave the offer alone');
  change('tr:1', pcA, 0, [put('it:h0', 1, esc('tr:1', pcA))]);
  eq(tradeRow('tr:1'), '1|open|-|-|-', 'A offers a +0 helm: version 1');
  change('tr:1', pcB, 1, [put('it:h3', 1, esc('tr:1', pcB))]);
  eq([tradeRow('tr:1'), escrowIds('tr:1')], ['2|open|-|-|-', ['it:h0', 'it:h3']], 'B offers a +3 helm: version 2, both in escrow');
  // M5 / M6: accepts
  refused('an accept at a stale version', 'offer moved', () => accept('tr:1', pcA, 1));
  refused('an accept by a character that is not a side', 'is not a side', () => accept('tr:1', pcC, 2));
  accept('tr:1', pcA, 2);
  refused('settle with one side accepted', 'not accepted by both sides', () => settle('tr:1', 2, []));
  accept('tr:1', pcB, 2);
  eq(tradeRow('tr:1'), '2|open|2|2|-', 'both accepted version 2');
  const swapOps = [put('it:h0', 2, loc('pack', pcB, 5)), put('it:h3', 2, loc('pack', pcA, 5)), ev('trade', A, 'trade:t1:a'), ev('trade', B, 'trade:t1:b')];
  refused('settle at another offer version', 'offer moved', () => settle('tr:1', 1, swapOps));
  refused('settle routing a piece to a third party', 'goes to the other side', () => settle('tr:1', 2, [put('it:h0', 2, loc('pack', pcC, 5)), swapOps[1], swapOps[2], swapOps[3]]));
  refused('settle routing a piece back to its own offerer', 'goes to the other side', () => settle('tr:1', 2, [put('it:h0', 2, loc('pack', pcA, 5)), swapOps[1]]));
  refused('settle with a mint', 'not allowed in a settle', () => settle('tr:1', 2, [...swapOps, mintOp('it:x', 'x', 1, loc('pack', pcA, 9), 'mk:x')]));
  refused('settle with a burn', 'not allowed in a settle', () => settle('tr:1', 2, [...swapOps, { op: 'burn', id: 'it:sw', expected_version: 1, count: 1 }]));
  refused('settle with a put of a piece outside the offer', 'outside the accepted offer', () => settle('tr:1', 2, [...swapOps, put('it:sw', 1, loc('pack', pcB, 7))]));
  refused('settle moving only one of the two pieces', 'moves every accepted piece', () => settle('tr:1', 2, [swapOps[0], swapOps[2], swapOps[3]]));
  refused('settle with a piece at the wrong version', 'accepted version', () => settle('tr:1', 2, [put('it:h0', 1, loc('pack', pcB, 5)), swapOps[1]]));
  refused('settle with an event of another kind', 'trade events for the two sides only', () => settle('tr:1', 2, [...swapOps.slice(0, 2), ev('burn', A, 'x:1')]));
  refused('settle with an event for a third account', 'trade events for the two sides only', () => settle('tr:1', 2, [...swapOps.slice(0, 2), ev('trade', C, 'x:2')]));
  eq([tradeRow('tr:1'), escrowIds('tr:1')], ['2|open|2|2|-', ['it:h0', 'it:h3']], 'every refused settle left the trade and its escrow untouched');
  accept('tr:1', pcB, 2, false);
  eq(tradeRow('tr:1'), '2|open|2|-|-', 'a side can withdraw its accept');
  refused('settle after an accept was withdrawn', 'not accepted by both sides', () => settle('tr:1', 2, swapOps));
  accept('tr:1', pcB, 2);
  // (a) REQUIRED: a +0 <-> +3 helm swap settles through the deferred one-of-each count
  settle('tr:1', 2, swapOps);
  iq(`where id in ('it:h0', 'it:h3')`, [`it:h0|1|3|pack:${pcB}:5`, `it:h3|1|3|pack:${pcA}:5`], 'REQUIRED (a): the +0 / +3 helm swap settled; each account holds exactly one helm');
  eq([tradeRow('tr:1'), escrowIds('tr:1')], ['2|settled|2|2|-', []], 'settled, and nothing left in escrow');
  eq(psql(`select count(*) from public.origins_events where event_id like 'trade:t1:%'`), '2', 'one trade event per side');
  refused('a settled trade takes no more offers', 'is not open', () => change('tr:1', pcA, 2, []));

  // (b) REQUIRED: a trade that would leave an account holding two copies still fails at commit
  open('tr:3', pcA, pcC);
  change('tr:3', pcC, 0, [put('it:hc', 1, esc('tr:3', pcC))]);   // A already holds the +3 helm; C offers a helm as a gift
  accept('tr:3', pcA, 1); accept('tr:3', pcC, 1);
  refused('REQUIRED (b): a settle that would leave A with two helms fails at commit', 'origins_items_one_of_each', () => settle('tr:3', 1, [put('it:hc', 2, loc('pack', pcA, 6)), ev('trade', A, 'trade:t3:a'), ev('trade', C, 'trade:t3:c')]));
  eq([tradeRow('tr:3'), escrowIds('tr:3')], ['1|open|1|1|-', ['it:hc']], 'the failed settle rolled back whole: the trade is still open with its escrow');
  // the accepted set pins the escrow: a row that moved since the accept refuses the settle
  psql(`select set_config('origins.trade', 'on', false); update public.origins_items set version = version + 1 where id = 'it:hc';`);
  refused('a piece whose version moved since the accept', 'escrow differs from what was accepted', () => settle('tr:3', 1, [put('it:hc', 3, loc('pack', pcA, 6)), ev('trade', A, 'trade:t3:a'), ev('trade', C, 'trade:t3:c')]));
  // M7: cancel
  refused('cancel with a bad reason', 'cancel reason', () => cancel('tr:3', 'because', []));
  refused('cancel that leaves a piece in escrow', 'left 1 rows in escrow', () => cancel('tr:3', 'cancelled', []));
  refused("cancel sending a piece to someone who did not offer it", "goes back to its offerer", () => cancel('tr:3', 'cancelled', [put('it:hc', 3, loc('pack', pcA, 6))]));
  refused('cancel with a put of a piece that is not in this trade', 'not an escrowed piece of this trade', () => cancel('tr:3', 'cancelled', [put('it:cup', 1, loc('pack', pcC, 4))]));
  refused('cancel with a mint', 'not allowed in a cancel', () => cancel('tr:3', 'cancelled', [mintOp('it:x', 'x', 1, loc('pack', pcC, 9), 'mk:x')]));
  cancel('tr:3', 'cancelled', [put('it:hc', 3, loc('pack', pcC, 4))]);
  eq([tradeRow('tr:3'), escrowIds('tr:3')], ['1|cancelled|1|1|cancelled', []], 'a proper cancel returns the piece and records its reason');
  iq(`where id = 'it:hc'`, [`it:hc|1|4|pack:${pcC}:4`], 'the piece is back with C');

  // erasure: a side deleted mid-trade (the cascade removes its escrow); the survivor cancels and gets its piece back
  open('tr:4', pcA, pcC);
  change('tr:4', pcA, 0, [put('it:sw', 1, esc('tr:4', pcA))]); change('tr:4', pcC, 1, [put('it:cup', 1, esc('tr:4', pcC))]);
  refused('a piece cannot leave escrow by a plain commit either', 'only inside the trade functions', () => commit(A, [put('it:sw', 2, loc('pack', pcA, 3))]));
  psql(`delete from auth.users where id = '${C}';`);
  eq(psql(`select coalesce(side_b, 'null') from public.origins_trades where container = 'tr:4'`), 'null', 'the erased side is nulled');
  refused('a trade that lost a side cannot settle', 'lost a side', () => settle('tr:4', 2, []));
  cancel('tr:4', 'side-erased', [put('it:sw', 2, loc('pack', pcA, 3))]);
  eq(tradeRow('tr:4'), '2|cancelled|-|-|side-erased', 'the survivor cancelled with reason side-erased');
  iq(`where id = 'it:sw'`, [`it:sw|1|3|pack:${pcA}:3`], "the survivor's piece came back");

  // M17: two concurrent transactions each giving B a copy of one single-copy piece: the second to commit must fail
  const mint = (id, idx) => `select public.origins_commit('${B}', ${J([mintOp(id, 'ring', 1, loc('pack', pcB, idx), `mk:${id}`, one)])});`;
  const first = psqlAsync(`set role frankendom_origins; begin; ${mint('it:r1', 7)} select pg_sleep(2); commit;`);
  await new Promise(r => setTimeout(r, 700));
  const second = psqlAsync(`set role frankendom_origins; begin; ${mint('it:r2', 8)} commit;`);
  const results = await Promise.all([first, second]);
  eq(results.filter(r => r.code !== 0).length, 1, 'M17: exactly one of two racing transactions fails');
  eq(results.some(r => r.err.includes('origins_items_one_of_each')), true, 'M17: and it fails on one-of-each, not by luck');
  eq(psql(`select count(*) from public.origins_items where holder_account = '${B}' and item = 'ring' and retired_at is null`), '1', 'M17: B holds exactly one ring');

  // M17: the commit takes the (holder, item) advisory lock: with another session holding that key, a commit that touches the pair waits for it
  const lockSql = `select pg_advisory_xact_lock(hashtextextended('${A}|ring2', 0));`;
  const holder = psqlAsync(`begin; ${lockSql} select pg_sleep(2); commit;`);
  await new Promise(r => setTimeout(r, 600));
  const t0 = Date.now();
  const waited = await psqlAsync(`set role frankendom_origins; begin; select public.origins_commit('${A}', ${J([mintOp('it:r3', 'ring2', 1, loc('pack', pcA, 8), 'mk:r3', one)])}); commit;`);
  const took = Date.now() - t0; await holder;
  eq([waited.code, took >= 1000], [0, true], `M17: a commit on a locked (holder, item) waits for the lock (took ${took} ms)`);
  // down: refused while a trade event exists (append-only), clean after the purge
  refused('down is refused while a trade event exists', 'origins_events_kind_check', () => down());
  W(`select public.origins_purge_account('${A}');`); W(`select public.origins_purge_account('${B}');`);
  down(); same('down #2');
  console.log(`origins-trade-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
