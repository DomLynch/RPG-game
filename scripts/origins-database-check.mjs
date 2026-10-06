// Origins server save and verify (migration 202610060001_origins_save.sql + its down-script) on real PostgreSQL, in the same disposable
// socket-only cluster as awards-database-check.mjs: no DATABASE_URL, no SUPABASE_* and no service-role key is read, so it cannot reach a hosted
// project. Every invariant the migration claims is attacked here as the writer role or as a client, plus the Pit pipeline end to end
// (the model's award() on the DERIVED total) and the down-script's "drops exactly what it creates".
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { LEGEND_OPPONENTS } from '../src/legends.ts';
import { award, creditFromMarks, cumulative, legendKey, levelOfCredit, newCareer, nextLegend } from '../origins/progression/model.ts';

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
    insert into auth.users values ('${A}'),('${B}'),('${C}'),('${N}'),('${E}'),('${F}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  apply(files.filter(n => n !== UP && n < UP));
  const before = objects(), aclsBefore = acls(), riBefore = riTriggers();
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${A}','Aldren',4,'{"owned":[],"equipped":{}}'),('${C}','Cass',0,'{"owned":[],"equipped":{}}');`);
  apply([UP]);

  // ---- the flag is OFF: nothing works, nothing shows -----------------------------------------------------------------------------
  refused('flag off: creating a character', 'origins is not open', () => W(`select public.origins_create_character('${A}', 'Aldren');`));
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled';`);   // on, but no account is on the allowlist yet
  refused('on but not on the allowlist', 'origins is not open', () => W(`select public.origins_create_character('${A}', 'Aldren');`));
  psql(`insert into public.origins_access(account) values ('${A}'),('${B}'),('${C}'),('${E}'),('${F}');`);

  // ---- characters, the career snapshot -------------------------------------------------------------------------------------------
  const pcA1 = W(`select public.origins_create_character('${A}', 'Aldren');`), pcA2 = W(`select public.origins_create_character('${A}', 'Aldren II');`), pcB = W(`select public.origins_create_character('${B}', 'Bran');`);
  eq([pcA1, pcA2, pcB].every(id => /^pc:[0-9a-f]{32}$/.test(id)), true, 'character ids');
  refused('a second Aldren on one account', 'duplicate key', () => W(`select public.origins_create_character('${A}', 'Aldren');`));
  const open0 = JSON.parse(W(`select public.origins_open('${A}')::text;`));
  eq([open0.marks, open0.career], [4, null], 'before the snapshot: marks are returned, no career');
  refused('a snapshot from stale marks', 'marks moved', () => W(`select public.origins_snapshot('${A}', 3, 5000);`));
  const seed = creditFromMarks(4);
  W(`select public.origins_snapshot('${A}', 4, ${seed});`);
  W(`select public.origins_snapshot('${A}', 4, 999999);`);   // a second snapshot, even with another number, changes nothing: the first one stands
  const open1 = JSON.parse(W(`select public.origins_open('${A}')::text;`));
  eq([open1.career.seed_credit, open1.career.world_credit, open1.career.total_credit], [seed, 0, seed], 'the seed is frozen, total derived');
  refused('the seed cannot be edited', 'frozen', () => psql(`update public.origins_career set seed_credit = 1, version = version + 1 where account = '${A}';`));
  refused('world credit never decreases', 'never decreases', () => psql(`update public.origins_career set world_credit = world_credit - 1, version = version + 1 where account = '${A}';`));

  // ---- items: mint, split, merge, burn; conservation --------------------------------------------------------------------------
  commit(A, [mintOp('it:ore', 'iron-ore', 10, loc('pack', pcA1, 0), 'mk:ore')]);
  iq(`where mint_root = 'mk:ore'`, ['it:ore|10|1|pack:' + pcA1 + ':0'], 'minted');
  commit(A, [{ op: 'split', id: 'it:ore', expected_version: 1, count: 3, new_id: 'it:ore:s', loc: loc('pack', pcA1, 1) }]);
  iq(`where mint_root = 'mk:ore'`, ['it:ore:s|3|1|pack:' + pcA1 + ':1', 'it:ore|7|2|pack:' + pcA1 + ':0'], 'split: the child under parent::s<version>');
  eq(psql(`select mint_key from public.origins_items where id = 'it:ore:s'`), 'mk:ore::s2', 'child key');
  commit(A, [{ op: 'merge', from_id: 'it:ore:s', from_version: 1, into_id: 'it:ore', into_version: 2 }]);
  iq(`where mint_root = 'mk:ore'`, ['it:ore:s|3|2|retired', 'it:ore|10|3|pack:' + pcA1 + ':0'], 'merged back, the child retired');
  commit(A, [{ op: 'burn', id: 'it:ore', expected_version: 3, count: 4 }]);
  eq(psql(`select sum(delta) from public.origins_item_ledger where mint_root = 'mk:ore'`), '6', 'the ledger books the burn');
  refused('a split that does not leave a remainder', 'refused', () => commit(A, [{ op: 'split', id: 'it:ore', expected_version: 4, count: 6, new_id: 'x', loc: loc('pack', pcA1, 2) }]));
  refused('conservation: a quantity edited behind the writer', 'conservation', () => psql(`begin; update public.origins_items set quantity = quantity + 1, version = version + 1 where id = 'it:ore'; commit;`));
  refused('conservation: a lost row', 'conservation', () => psql(`begin; update public.origins_items set retired_at = now(), retire_reason = 'burn', loc_kind = null, loc_owner = null, loc_index = null, version = version + 1 where id = 'it:ore'; commit;`));
  iq(`where id = 'it:ore'`, ['it:ore|6|4|pack:' + pcA1 + ':0'], 'both refused commits left the stack untouched');
  refused('a retired mint key cannot be minted again', 'duplicate key', () => commit(A, [mintOp('it:ore2', 'iron-ore', 1, loc('pack', pcA1, 5), 'mk:ore')]));

  // ---- places, grids, versions, accounts -------------------------------------------------------------------------------------
  refused('two items in one place', 'origins_items_pack_place', () => commit(A, [mintOp('it:x', 'wood', 1, loc('pack', pcA1, 0), 'mk:x')]));
  refused('a slot past the grid', 'past this character', () => commit(A, [mintOp('it:y', 'wood', 1, loc('pack', pcA1, 64), 'mk:y')]));
  commit(A, [mintOp('it:crown', 'crown', 1, loc('pack', pcA1, 2), 'mk:crown', { single_copy: true })]);
  refused('one of each, account-wide (a second character on the same account)', 'origins_items_one_of_each', () => commit(A, [mintOp('it:crown2', 'crown', 1, loc('pack', pcA2, 0), 'mk:crown2', { single_copy: true })]));
  commit(B, [mintOp('it:crownB', 'crown', 1, loc('pack', pcB, 0), 'mk:crownB', { single_copy: true })]);   // another account may hold its own
  refused('a stale version', 'stale or unknown', () => commit(A, [{ op: 'put', id: 'it:crown', expected_version: 9, loc: loc('pack', pcA1, 3) }]));
  refused('moving another account\'s item', 'not this batch', () => commit(A, [{ op: 'put', id: 'it:crownB', expected_version: 1, loc: loc('pack', pcA1, 9) }]));
  refused('moving an item onto another account\'s character', 'would leave', () => commit(A, [{ op: 'put', id: 'it:ore', expected_version: 4, loc: loc('pack', pcB, 5) }]));
  commit(A, [{ op: 'put', id: 'it:crown', expected_version: 1, loc: { kind: 'equipped', owner: pcA1, slot: 'head' }, history_append: [{ kind: 'upgrade', level: 1, receipt: 'r1', at: '2026-10-06T00:00:01Z' }] }]);
  iq(`where id = 'it:crown'`, ['it:crown|1|2|equipped:' + pcA1 + ':head'], 'equipped');
  refused('history only grows', 'append-only', () => psql(`update public.origins_items set history = '[]'::jsonb, version = version + 1 where id = 'it:crown';`));
  refused('provenance is fixed at mint', 'fixed at mint', () => psql(`update public.origins_items set provenance = '{"kind":"loot","mintKey":"mk:crown","at":"2030-01-01T00:00:00Z"}'::jsonb, version = version + 1 where id = 'it:crown';`));
  refused('items are never deleted', 'append-only', () => psql(`delete from public.origins_items where id = 'it:crown';`));
  refused('a batch is all or nothing (a good op, then a stale one)', 'stale or unknown', () => commit(A, [mintOp('it:z', 'wood', 1, loc('pack', pcA1, 7), 'mk:z'), { op: 'put', id: 'it:crown', expected_version: 1, loc: loc('pack', pcA1, 8) }]));
  iq(`where id = 'it:z'`, [], 'the good op of the failed batch is gone');

  // ---- events (rewards once), quests, talk -----------------------------------------------------------------------------------
  const ev = (id, kind = 'quest-stage') => ({ op: 'event', event_id: id, kind, account: A, character: pcA1, payload: {} });
  commit(A, [ev(`quest:${pcA1}:q1:s2`), mintOp('it:reward', 'sword', 1, loc('pack', pcA1, 10), 'mk:reward')]);
  refused('a reward paid twice', 'already settled', () => commit(A, [ev(`quest:${pcA1}:q1:s2`), mintOp('it:reward2', 'sword', 1, loc('pack', pcA1, 11), 'mk:reward2')]));
  iq(`where id = 'it:reward2'`, [], 'the replayed batch minted nothing');
  commit(A, [{ op: 'quest_set', character: pcA1, quest: 'q1', story_version: 1, stage: 's1', status: 'active', flags: {}, rewarded: [], journal_append: [{ stage: 's1', text: 'He asked me to find the ore.', at: '2026-10-06T01:00:00Z' }] }]);
  commit(A, [{ op: 'quest_set', character: pcA1, quest: 'q1', expected_version: 1, story_version: 1, stage: 's2', status: 'active', flags: { met: true }, rewarded: ['s2'], journal_append: [{ stage: 's2', text: 'The ore is in the mine.', at: '2026-10-06T02:00:00Z' }] }]);
  eq(psql(`select string_agg(seq || ':' || stage, ',' order by seq) from public.origins_quest_journal where character = '${pcA1}'`), '0:s1,1:s2', 'journal seq continues');
  refused('a stale quest write', 'stale', () => commit(A, [{ op: 'quest_set', character: pcA1, quest: 'q1', expected_version: 1, story_version: 1, stage: 's3', status: 'active', flags: {}, rewarded: [], journal_append: [] }]));
  refused('a journal line is never edited', 'append-only', () => psql(`update public.origins_quest_journal set text = 'rewritten';`));
  refused('a journal line is never deleted', 'append-only', () => psql(`delete from public.origins_quest_journal;`));
  commit(A, [{ op: 'talk_set', character: pcA1, told: ['orla:hello'], flags: { orla: true } }]);
  refused('a stale talk write', 'stale', () => commit(A, [{ op: 'talk_set', character: pcA1, expected_version: 5, told: [], flags: {} }]));
  refused('a quest on a character that is not this account\'s', 'outside this batch', () => commit(A, [{ op: 'quest_set', character: pcB, quest: 'q1', story_version: 1, stage: 's1', status: 'active', flags: {}, rewarded: [], journal_append: [] }]));
  refused('an unknown op', 'unknown op', () => commit(A, [{ op: 'rm-rf' }]));

  // ---- trades: both sides in one transaction ----------------------------------------------------------------------------------
  commit(A, [mintOp('it:gem', 'gem', 1, loc('pack', pcA1, 20), 'mk:gem', { single_copy: true })]);
  W(`select public.origins_open_trade('tr:1', '${pcA1}', '${pcB}');`);
  const escrow = { kind: 'trade-escrow', container: 'tr:1', from: pcA1 };
  const hist = { kind: 'trade', trade: 'tr:1', from: pcA1, to: pcB, at: '2026-10-06T03:00:00Z' };
  W(`select public.origins_settle_trade('tr:1', ${J([{ op: 'put', id: 'it:gem', expected_version: 1, loc: escrow }, { op: 'put', id: 'it:gem', expected_version: 2, loc: loc('pack', pcB, 1), history_append: [hist] }])});`);
  iq(`where id = 'it:gem'`, ['it:gem|1|3|pack:' + pcB + ':1'], 'the gem crossed in one settle');
  eq(psql(`select state from public.origins_trades where container = 'tr:1'`), 'settled', 'trade state');
  W(`select public.origins_open_trade('tr:2', '${pcA1}', '${pcB}');`);
  refused('a trade that breaks one-of-each on the receiver rolls back whole', 'origins_items_one_of_each', () => W(`select public.origins_settle_trade('tr:2', ${J([{ op: 'put', id: 'it:crown', expected_version: 2, loc: loc('pack', pcB, 2) }])});`));
  iq(`where id = 'it:crown'`, ['it:crown|1|2|equipped:' + pcA1 + ':head'], 'the refused trade moved nothing');
  refused('settling a trade twice', 'is not open', () => W(`select public.origins_settle_trade('tr:1', '[]'::jsonb);`));

  // ---- RLS: a client reads its own rows, writes nothing, and the flag shuts it ---------------------------------------------------
  eq(client(A, `select count(*) from public.origins_items;`), String(items(`where holder_account = '${A}'`).length), 'A sees exactly its own items');
  eq(client(B, `select count(*) from public.origins_items where id = 'it:crown';`), '0', 'B cannot see A\'s items');
  eq(client(A, `select count(*) from public.origins_characters;`), '2', 'A sees its two characters');
  eq(client(N, `select count(*) from public.origins_characters;`), '0', 'an account off the allowlist sees nothing');
  for (const [what, sql] of [
    ['insert into items', `insert into public.origins_items(id,item,quantity,mint_key,provenance) values ('h','x',1,'h','{}');`],
    ['update items', `update public.origins_items set quantity = 9999;`], ['delete items', `delete from public.origins_items;`],
    ['update career', `update public.origins_career set seed_credit = 999999999;`], ['insert a character', `insert into public.origins_characters(id,account,name) values ('pc:h','${A}','h');`],
    ['read the ledger', `select * from public.origins_item_ledger;`], ['read the config', `select * from public.origins_config;`], ['read the allowlist', `select * from public.origins_access;`],
    ['read encounters', `select * from public.origins_encounters;`], ['read trades', `select * from public.origins_trades;`],
    ['call origins_commit', `select public.origins_commit('${A}', '[]'::jsonb);`], ['call origins_apply', `select public.origins_apply('[]'::jsonb, array['${A}'::uuid]);`],
    ['call origins_open', `select public.origins_open('${A}');`], ['call origins_pit_pending', `select * from public.origins_pit_pending('${A}');`],
  ]) refused(`a client may not: ${what}`, 'permission denied', () => client(A, sql));
  for (const t of ['origins_items', 'origins_characters', 'origins_career', 'origins_events', 'origins_quest_state', 'origins_talk']) refused(`anon may not read ${t}`, 'permission denied', () => as('anon', null, `select * from public.${t};`));
  eq(psql(`select count(*) from pg_tables where schemaname = 'public' and tablename like 'origins_%' and not rowsecurity`), '0', 'RLS is on for every origins table');
  psql(`update public.origins_config set value = 'false'::jsonb where key = 'origins_enabled';`);
  eq(client(A, `select count(*) from public.origins_items;`), '0', 'flag off: a client sees nothing again');
  refused('flag off: the writer is refused too', 'origins is not open', () => commit(A, []));
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled';`);
  eq(client(A, `select count(*) from public.origins_items;`) !== '0', true, 'flag on: visible again');

  // ---- encounters: single use ------------------------------------------------------------------------------------------------
  W(`select public.origins_issue_encounter('${A}', '${pcA1}', 'tok0000000000000001', 77, 'goblin-scout', 4, 600);`);
  eq(JSON.parse(W(`select public.origins_consume_encounter('${A}', 'tok0000000000000001')::text;`)).enemy, 'goblin-scout', 'an encounter token is consumed');
  refused('an encounter token twice', 'unknown, used or expired', () => W(`select public.origins_consume_encounter('${A}', 'tok0000000000000001')::text;`));
  refused('someone else\'s encounter token', 'unknown, used or expired', () => W(`select public.origins_consume_encounter('${B}', 'tok0000000000000001')::text;`));

  // ---- the Pit pipeline on the derived total: a Pit-only account stalls at L11 ---------------------------------------------------
  const claim = (user, opponent, n, checked) => psql(`insert into public.loot_claims(user_id, opponent, record, verified, checked_at, fight_hash) values ('${user}', '${opponent}', 'rec${user.slice(0, 4)}${n}', true, ${checked}, '${n.toString(16).padStart(64, '0')}') returning id;`).split('\n')[0];
  // C: marks 0 at the snapshot. A claim verified BEFORE the snapshot is in the seed, never imported; every later one is priced by the model.
  psql(`alter table public.loot_claims disable trigger loot_claims_rate;`);   // the live rate cap is sixty claims an hour; the stall below needs sixty-one fixture claims
  const early = claim(C, 'veteran', 1, `now() - interval '1 hour'`);
  W(`select public.origins_open('${C}');`);
  W(`select public.origins_snapshot('${C}', 0, ${creditFromMarks(0)});`);
  const pcC = W(`select public.origins_create_character('${C}', 'Cass');`);
  let state = newCareer(0), wins = 0, n = 10;
  const pending = () => W(`select claim_id || '|' || opponent from public.origins_pit_pending('${C}');`).split('\n').filter(Boolean);
  eq(pending(), [], 'a win verified before the snapshot is not pending (it is in the seed)');
  for (let opponent = nextLegend(state, LEGEND_OPPONENTS, 0); opponent !== null; opponent = nextLegend(state, LEGEND_OPPONENTS, wins * 7919)) {
    const id = claim(C, opponent, n++, 'now()');
    eq(pending(), [`${id}|${opponent}`], 'the new win is pending');
    const total = Number(JSON.parse(W(`select public.origins_open('${C}')::text;`)).career.total_credit);
    eq(total, state.credit, `the derived total matches the model after ${wins} wins`);
    const a = award(state, { kind: 'arena-win', id: `pit:${id}`, at: wins, opponent });
    commit(C, [
      { op: 'event', event_id: `pit:${id}`, kind: 'pit', account: C, character: pcC, payload: { cp: a.cp, legend: legendKey(opponent, a.levelBefore) } },
      { op: 'career_set', account: C, expected_version: JSON.parse(W(`select public.origins_open('${C}')::text;`)).career.version, world_credit: 0, rested: 0, rested_at: 0, heat: {}, story: [], beaten: [...a.state.beaten] },
    ]);
    refused('a Pit win imported twice', 'already settled', () => commit(C, [{ op: 'event', event_id: `pit:${id}`, kind: 'pit', account: C, character: pcC, payload: { cp: a.cp, legend: 'x' } }]));
    state = a.state; wins++;
  }
  const finalTotal = Number(JSON.parse(W(`select public.origins_open('${C}')::text;`)).career.total_credit);
  eq([wins, finalTotal, levelOfCredit(finalTotal)], [60, cumulative(11) + 2000, 11], 'a Pit-only account stalls at level 11 through the server pipeline');
  eq(early !== undefined, true, 'the early claim existed');

  eq(acls(), aclsBefore, 'no grant, policy, trigger or RLS setting on any existing object changed (column-level ACLs and function ACLs included)');
  // The RI-trigger delta: exactly two per foreign key that references an existing table, and every such table is auth.users (never a public live table).
  const refs = psql(`select confrelid::regclass || ' ' || count(*) from pg_constraint where contype = 'f' and conrelid::regclass::text like 'origins\\_%' and confrelid::regclass::text not like 'origins\\_%' group by confrelid::regclass;`);
  eq(refs.split('\n').map(l => l.split(' ')[0]), ['auth.users'], 'the only existing table an origins_ foreign key references is auth.users (no public live table)');
  const fkCount = Number(refs.split(' ')[1]);
  const riAfter = riTriggers();
  const riDelta = riAfter.filter(l => !riBefore.includes(l));
  eq(riDelta.length >= 1 && riDelta.every(l => l.startsWith('auth.users <- origins_')), true, 'every new internal trigger on an existing table sits on auth.users and belongs to an origins_ foreign key');
  eq(psql(`select count(*) from pg_trigger t join pg_class r on r.oid = t.tgrelid where t.tgisinternal and r.relname = 'users' and r.relnamespace = 'auth'::regnamespace and t.tgconstraint in (select oid from pg_constraint where conrelid::regclass::text like 'origins\\_%')`), String(fkCount * 2), 'two internal triggers on auth.users per origins_ foreign key, no more');
  eq(riBefore.every(l => riAfter.includes(l)), true, 'no pre-existing internal trigger changed');
  eq(aclsBefore.includes('fighter_profiles') && aclsBefore.includes('loot_claims'), true, 'the ACL snapshot does cover the live tables the functions read');

  // ---- function hygiene: every origins definer function pins its search_path and answers only to the writer -------------------------------
  const fns = psql(`select p.oid::regprocedure || '|' || p.prosecdef || '|' || coalesce(p.proconfig::text, '') || '|' || pg_get_function_result(p.oid) || '|' || pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'origins\\_%' order by 1;`).split('\n').map(l => l.split('|'));
  eq(fns.length >= 20, true, 'the catalog lists the origins functions');
  const clientHelpers = new Set(['origins_me_allowed()', 'origins_me_owns(text)']);   // the RLS policies call these as the reader; they answer only about auth.uid()
  const argFor = type => ({ uuid: `'${A}'::uuid`, text: `'x'`, jsonb: `'[]'::jsonb`, bigint: '0', integer: '0', 'uuid[]': 'array[]::uuid[]' })[type] ?? fail(`no dummy argument for ${type}`);
  for (const [sig, secdef, config, result, args] of fns) {
    const bare = sig.replace('public.', '');
    if (secdef === 'true') eq(/search_path=(\\?")\1/.test(config), true, `${bare} is SECURITY DEFINER with search_path = ''`);
    for (const who of ['anon', 'authenticated']) {
      const may = psql(`select has_function_privilege('${who}', '${sig}', 'execute')`) === 't';
      eq(may, who === 'authenticated' && clientHelpers.has(bare), `${who} execute on ${bare}`);
    }
    const internal = ['origins_apply(jsonb,uuid[])', 'origins_allowed(uuid)', 'origins_owns(text,uuid)'].includes(bare.replace(/, /g, ','));
    eq(psql(`select has_function_privilege('frankendom_origins', '${sig}', 'execute')`) === 't', !internal && result !== 'trigger' && !clientHelpers.has(bare), `the writer role can execute ${bare} exactly when it is a writer entry point`);
    if (result !== 'trigger' && !clientHelpers.has(bare)) {
      const call = `select * from ${sig.replace(/\(.*$/, '')}(${args === '' ? '' : args.split(', ').map(a => argFor(a.split(' ').slice(1).join(' '))).join(', ')});`;
      for (const who of ['anon', 'authenticated']) refused(`${who} calling ${bare}`, 'permission denied', () => as(who, A, call));
    }
  }

  // ---- erasure is never blocked ----------------------------------------------------------------------------------------------------
  const seedE = pc => {
    commit(E, [mintOp('it:e1', 'ore2', 5, loc('pack', pc, 0), 'mk:e1'), mintOp('it:e2', 'ore3', 4, loc('pack', pc, 1), 'mk:e2'), mintOp('it:e3', 'gem2', 1, loc('pack', pc, 2), 'mk:e3', { single_copy: true }),
      { op: 'event', event_id: `quest:${pc}:q9:s1`, kind: 'quest-stage', account: E, character: pc, payload: {} },
      { op: 'quest_set', character: pc, quest: 'q9', story_version: 1, stage: 's1', status: 'active', flags: {}, rewarded: ['s1'], journal_append: [{ stage: 's1', text: 'Erase me.', at: '2026-10-06T05:00:00Z' }] },
      { op: 'talk_set', character: pc, told: ['x'], flags: {} }]);
  };
  const pcE = W(`select public.origins_create_character('${E}', 'Edda');`);
  W(`select public.origins_snapshot('${E}', 0, 0);`);
  seedE(pcE);
  // E hands one of its ore3 to B through a settled trade (the root mk:e2 now lives on two accounts), and leaves a trade open with B holding escrow.
  W(`select public.origins_open_trade('tr:e0', '${pcE}', '${pcB}');`);
  W(`select public.origins_settle_trade('tr:e0', ${J([{ op: 'split', id: 'it:e2', expected_version: 1, count: 1, new_id: 'it:e2:s', loc: { kind: 'trade-escrow', container: 'tr:e0', from: pcE } }, { op: 'put', id: 'it:e2:s', expected_version: 1, loc: loc('pack', pcB, 30) }])});`);
  commit(B, [mintOp('it:b9', 'ore4', 2, loc('pack', pcB, 31), 'mk:b9')]);
  W(`select public.origins_open_trade('tr:e', '${pcE}', '${pcB}');`);
  W(`select public.origins_commit('${B}', ${J([{ op: 'put', id: 'it:b9', expected_version: 1, loc: { kind: 'trade-escrow', container: 'tr:e', from: pcB } }])});`);
  refused('direct deletes are still refused outside erasure (items)', 'append-only', () => psql(`delete from public.origins_items where id = 'it:e1';`));
  refused('direct deletes are still refused outside erasure (events)', 'append-only', () => psql(`delete from public.origins_events;`));
  refused('a client may not call the purge', 'permission denied', () => client(E, `select public.origins_purge_account('${E}');`));
  const purged = JSON.parse(W(`select public.origins_purge_account('${E}')::text;`));
  eq([purged.characters, purged.live_items], [1, 3], 'the purge reports what it removed');
  for (const t of ['origins_characters', 'origins_career', 'origins_access', 'origins_events']) eq(psql(`select count(*) from public.${t} where account = '${E}'`), '0', `${t}: nothing of E is left`);
  eq(psql(`select count(*) from public.origins_items where id in ('it:e1','it:e2','it:e3')`), '0', 'E\'s items are gone');
  eq(psql(`select count(*) from public.origins_quest_state where character = '${pcE}'`) + psql(`select count(*) from public.origins_quest_journal where character = '${pcE}'`) + psql(`select count(*) from public.origins_talk where character = '${pcE}'`), '000', 'quests, journal and talk are gone');
  iq(`where id = 'it:e2:s'`, ['it:e2:s|1|2|pack:' + pcB + ':30'], 'B keeps the ore3 it was traded');
  eq(psql(`select state || ':' || coalesce(side_a, 'null') || ':' || side_b from public.origins_trades where container = 'tr:e'`), `open:null:${pcB}`, 'the open trade lost its side, kept the survivor');
  refused('a trade that lost a side cannot settle', 'lost a side', () => W(`select public.origins_settle_trade('tr:e', '[]'::jsonb);`));
  W(`select public.origins_cancel_trade('tr:e', ${J([{ op: 'put', id: 'it:b9', expected_version: 2, loc: loc('pack', pcB, 31) }])});`);
  iq(`where id = 'it:b9'`, ['it:b9|2|3|pack:' + pcB + ':31'], 'the survivor\'s escrow is released by cancel');
  commit(B, [{ op: 'burn', id: 'it:e2:s', expected_version: 2, count: 1 }]);   // conservation still holds for the root E minted and the purge burned
  eq(psql(`select sum(delta) from public.origins_item_ledger where mint_root = 'mk:e2'`), '0', 'mk:e2 balances to zero after the purge and B\'s burn');
  // Deleting the account itself (auth.users) cascades through everything with no help. F holds a pack item, a bank item and a split stack, minted a stack it
  // traded half of to B, left a trade open with B holding escrow, and B holds an item bound to F.
  const pcF = W(`select public.origins_create_character('${F}', 'Fenn');`);
  W(`select public.origins_snapshot('${F}', 0, 0);`);
  commit(F, [mintOp('it:f1', 'ore5', 6, loc('pack', pcF, 0), 'mk:f1'), mintOp('it:f2', 'ore6', 9, loc('bank', pcF, 3), 'mk:f2'), mintOp('it:f3', 'ore7', 4, loc('pack', pcF, 1), 'mk:f3'),
    { op: 'event', event_id: `quest:${pcF}:q9:s1`, kind: 'quest-stage', account: F, character: pcF, payload: {} },
    { op: 'quest_set', character: pcF, quest: 'q9', story_version: 1, stage: 's1', status: 'active', flags: {}, rewarded: [], journal_append: [{ stage: 's1', text: 'x', at: '2026-10-06T06:00:00Z' }] }]);
  commit(F, [{ op: 'split', id: 'it:f1', expected_version: 1, count: 2, new_id: 'it:f1:s', loc: loc('pack', pcF, 2) }]);   // a split stack: two rows, one root
  W(`select public.origins_open_trade('tr:f0', '${pcF}', '${pcB}');`);
  W(`select public.origins_settle_trade('tr:f0', ${J([{ op: 'split', id: 'it:f3', expected_version: 1, count: 1, new_id: 'it:f3:s', loc: { kind: 'trade-escrow', container: 'tr:f0', from: pcF } }, { op: 'put', id: 'it:f3:s', expected_version: 1, loc: loc('pack', pcB, 40) }])});`);
  commit(B, [mintOp('it:bf', 'ore8', 1, loc('pack', pcB, 41), 'mk:bf', { bound_to: pcF }), mintOp('it:bf2', 'ore9', 2, loc('pack', pcB, 42), 'mk:bf2')]);
  W(`select public.origins_open_trade('tr:f', '${pcF}', '${pcB}');`);
  W(`select public.origins_commit('${B}', ${J([{ op: 'put', id: 'it:bf2', expected_version: 1, loc: { kind: 'trade-escrow', container: 'tr:f', from: pcB } }])});`);
  W(`select public.origins_issue_encounter('${F}', '${pcF}', 'tok0000000000000009', 5, 'rat', 1, 600);`);
  const burnsBefore = Number(psql(`select count(*) from public.origins_item_ledger where reason = 'burn'`));
  const fLive = Number(psql(`select count(*) from public.origins_items where holder_account = '${F}' and retired_at is null`));
  eq(fLive, 4, 'F holds 4 live rows: pack stack, its split child, a bank stack, and the stack it kept after the trade');
  const bProvenance = psql(`select provenance::text from public.origins_items where id = 'it:f3:s'`);
  psql(`delete from auth.users where id = '${F}';`);   // ERASURE-1: must succeed (the deferred conservation trigger must not abort it at commit)
  for (const t of ['origins_characters', 'origins_career', 'origins_access', 'origins_events', 'origins_encounters']) eq(psql(`select count(*) from public.${t} where account = '${F}'`), '0', `ERASURE-1: deleting the account cleared ${t}`);
  eq(psql(`select count(*) from public.origins_items where id in ('it:f1', 'it:f1:s', 'it:f2', 'it:f3')`), '0', 'ERASURE-1: the account\'s pack, split, bank and kept-stack rows are all gone');
  eq(Number(psql(`select count(*) from public.origins_item_ledger where reason = 'burn'`)) - burnsBefore, fLive, 'ERASURE-1: one burn recorded per erased live row');
  eq(psql(`select coalesce(sum(delta), 0) from public.origins_item_ledger where mint_root in ('mk:f1', 'mk:f2')`), '0', 'ERASURE-1: roots only F held balance to zero');
  eq(psql(`select coalesce(sum(delta), 0) from public.origins_item_ledger where mint_root = 'mk:f3'`), '1', 'ERASURE-1: the root F traded half of still books the one unit B holds');
  // ERASURE-2: the other party's rows survive, the erased side is nulled, never cascaded away.
  iq(`where id in ('it:f3:s', 'it:bf', 'it:bf2')`, ['it:bf2|2|2|trade-escrow::', 'it:bf|1|1|pack:' + pcB + ':41', 'it:f3:s|1|2|pack:' + pcB + ':40'], 'ERASURE-2: B keeps its gift from F, its item bound to F, and its escrow');
  eq(psql(`select provenance::text from public.origins_items where id = 'it:f3:s'`), bProvenance, 'ERASURE-2: provenance on the surviving item is untouched');
  eq(psql(`select container || ':' || state || ':' || coalesce(side_a, 'null') || ':' || coalesce(side_b, 'null') from public.origins_trades where container in ('tr:f', 'tr:f0') order by container`), `tr:f:open:null:${pcB}\ntr:f0:settled:null:${pcB}`, 'ERASURE-2: both trades survive with the erased side nulled and the other side kept');
  W(`select public.origins_cancel_trade('tr:f', ${J([{ op: 'put', id: 'it:bf2', expected_version: 2, loc: loc('pack', pcB, 42) }])});`);
  iq(`where id = 'it:bf2'`, ['it:bf2|2|3|pack:' + pcB + ':42'], 'ERASURE-2: the survivor cancels the open trade and gets its escrow back');
  commit(B, [{ op: 'burn', id: 'it:f3:s', expected_version: 2, count: 1 }]);
  eq(psql(`select coalesce(sum(delta), 0) from public.origins_item_ledger where mint_root = 'mk:f3'`), '0', 'ERASURE-2: B can still spend what it was given, conservation holds');

  // ---- the down-script drops exactly what the migration created ------------------------------------------------------------------
  const after = objects();
  eq(after.split('\n').filter(l => !before.split('\n').includes(l)).every(l => /origins/.test(l)), true, 'the migration only adds origins_* objects and its role');
  eq(before.split('\n').every(l => after.split('\n').includes(l)), true, 'the migration removed nothing that existed');
  apply(files.filter(n => n > UP));   // the follow-up migrations go on after every 0001 check: they replace 0001's trade functions
  for (const n of files.filter(n => n > UP).reverse()) psql(readFileSync(join(dir, '..', 'down', n.replace('.sql', '_down.sql')), 'utf8'));   // follow-up migrations come off first, newest first
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(riTriggers(), riBefore, 'after the down-script the internal triggers on auth.users are exactly as before the migration');
  eq(objects(), before, 'after the down-script the public schema and roles are exactly as before the migration');
  console.log(`origins-database-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
