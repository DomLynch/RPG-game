// Rehearsal of migration 20261019170000_origins_spawn_layers (per-layer spawn clocks) on a DISPOSABLE PostgreSQL cluster, never on prod and with no prod data: every migration BEFORE it is applied, the three spawn tables
// are seeded to the shape prod has (rows in every state: alive, dead and waiting, dead past its respawn, open / used / expired / killed engages, ledger rows, no damage rows), then the layers migration is applied and rolled back.
// Proves: (1) apply keeps every row (counts and content unchanged but for the new layer column = 1), the key becomes (layer, instance), the foreign key is gone, and the OLD function names answer exactly what they answered
// before (state, engage_get, the kill on a seeded open token); (2) the ROLLBACK puts back the old primary key, the old foreign key, the old indexes and EVERY spawn function definition and grant, byte for byte (md5 of
// pg_get_functiondef and proacl, before apply against after rollback); (3) re-applying after the rollback works; (4) how long the apply and the rollback hold their locks (wall time of the transaction, on a seeded database).
// Run: runuser -u frankrows -- env PG_BIN=/usr/lib/postgresql/16/bin node --experimental-strip-types scripts/origins-spawn-layers-rehearsal.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const LAYERS = '20261019170000_origins_spawn_layers.sql', DOWN = '20261019170000_origins_spawn_layers_down.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-layers-rehearsal-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const [A, B, C] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
const T = n => `rehearsal-tok-${n}-`.padEnd(24, 'x');

// a fingerprint of everything the migration touches: keys, indexes, every spawn function's definition and grants, the rows
const fingerprint = () => ({
  constraints: psql(`select string_agg(conrelid::regclass || ':' || conname || ':' || pg_get_constraintdef(oid), E'\\n' order by conrelid::regclass::text, conname) from pg_constraint where conrelid in ('public.origins_spawns'::regclass, 'public.origins_spawn_engages'::regclass, 'public.origins_spawn_damage'::regclass) and contype in ('p', 'f', 'c')`),
  indexes: psql(`select string_agg(indexdef, E'\\n' order by indexname) from pg_indexes where schemaname = 'public' and tablename in ('origins_spawns', 'origins_spawn_engages', 'origins_spawn_damage')`),
  functions: psql(`select string_agg(p.oid::regprocedure::text || ':' || md5(pg_get_functiondef(p.oid)) || ':' || coalesce(p.proacl::text, ''), E'\\n' order by p.oid::regprocedure::text) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'origins\\_spawn\\_%'`),
  columns: psql(`select string_agg(table_name || '.' || column_name || ':' || data_type || ':' || column_default, E'\\n' order by table_name, column_name) from information_schema.columns where table_schema = 'public' and table_name in ('origins_spawns', 'origins_spawn_engages', 'origins_spawn_damage')`),
});
const rows = () => ({
  spawns: psql(`select count(*) || ':' || md5(coalesce(string_agg((to_jsonb(t) - 'layer')::text, '|' order by instance), '')) from public.origins_spawns t`),
  engages: psql(`select count(*) || ':' || md5(coalesce(string_agg((to_jsonb(t) - 'layer')::text, '|' order by token), '')) from public.origins_spawn_engages t`),
  ledger: psql(`select count(*) || ':' || md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by event_id), '')) from public.origins_beta_ledger t`),
});
const oldAnswers = () => ({   // what a writer that does not know layers reads (the clock `now` is the one field that moves, so it is dropped)
  state: psql(`select (public.origins_spawn_state(array['wolves-1','wolves-2','wolves-3','wolves-4','wolves-5','z2:wolves-1','opener-ash-1']) - 'now')::text`),
  engageGet: psql(`select coalesce(public.origins_spawn_engage_get('${A}', '${T(1)}'), 'null'::jsonb)::text`),
});
const timed = sql => { const t0 = process.hrtime.bigint(); psql(sql); return Number((process.hrtime.bigint() - t0) / 1_000_000n); };

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
  if (!files.includes(LAYERS)) fail(`${LAYERS} is missing from ${dir}`);
  psql(files.filter(n => n < LAYERS).map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));   // everything BEFORE the layers migration, as prod is
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}'), ('${C}');`);
  const pcs = Object.fromEntries([[A, 'Aria'], [B, 'Bran'], [C, 'Cara']].map(([a, n]) => [a, psql(`set role frankendom_origins; select public.origins_create_character('${a}', '${n}');`).split('\n').pop()]));

  // seed: spawn rows in every state (Zone 1 ids, a Zone 2 id, an opener), engages open / killed / dead / expired, ledger rows; no damage rows (prod has none yet)
  psql(`insert into public.origins_spawns (instance, kind, generation, alive, respawn_at, killed_by, killed_at) values
      ('wolves-1', 'character:ash-wolf', 0, true, null, null, null),
      ('wolves-2', 'character:ash-wolf', 3, false, now() + interval '90 seconds', '${A}', now() - interval '10 seconds'),
      ('wolves-3', 'character:ash-wolf', 1, false, now() - interval '5 minutes', '${B}', now() - interval '6 minutes'),
      ('wolves-4', 'character:ash-wolf', 7, true, null, null, null),
      ('wolves-5', 'character:ash-wolf', 2, false, now() + interval '30 seconds', '${C}', now() - interval '1 minute'),
      ('z2:wolves-1', 'character:ash-wolf', 0, true, null, null, null),
      ('opener-ash-1', 'character:ash-wolf', 4, true, null, null, null);
    insert into public.origins_spawn_engages (token, account, character, instance, generation, issued_at, touched_at, expires_at, used_at, result) values
      ('${T(1)}', '${A}', '${pcs[A]}', 'wolves-1', 0, now() - interval '20 seconds', now(), now() + interval '100 seconds', null, null),
      ('${T(2)}', '${A}', '${pcs[A]}', 'wolves-2', 3, now() - interval '2 minutes', now() - interval '1 minute', now() + interval '1 minute', now() - interval '10 seconds', 'killed'),
      ('${T(3)}', '${B}', '${pcs[B]}', 'wolves-2', 3, now() - interval '2 minutes', now() - interval '1 minute', now() + interval '1 minute', now() - interval '9 seconds', 'dead'),
      ('${T(4)}', '${B}', '${pcs[B]}', 'wolves-3', 1, now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '6 minutes', now() - interval '6 minutes', 'killed'),
      ('${T(5)}', '${C}', '${pcs[C]}', 'wolves-5', 2, now() - interval '3 minutes', now() - interval '2 minutes', now() - interval '1 minute', now() - interval '1 minute', 'killed'),
      ('${T(6)}', '${C}', '${pcs[C]}', 'wolves-4', 7, now() - interval '5 minutes', now() - interval '4 minutes', now() - interval '2 minutes', null, null),
      ('${T(7)}', '${C}', '${pcs[C]}', 'z2:wolves-1', 0, now() - interval '30 seconds', now(), now() + interval '90 seconds', null, null);
    insert into public.origins_beta_ledger (event_id, account, character, instance, item_ids, cp, bronze, reach_status) values
      ('enc:${T(2)}', '${A}', '${pcs[A]}', 'wolves-2', '{}', 20, 5, 'unchecked'),
      ('enc:${T(4)}', '${B}', '${pcs[B]}', 'wolves-3', '{}', 20, 7, 'unchecked'),
      ('enc:${T(5)}', '${C}', '${pcs[C]}', 'wolves-5', '{}', 20, 4, 'checked');`);

  const before = { fp: fingerprint(), rows: rows(), old: oldAnswers() };
  eq([before.rows.spawns.split(':')[0], before.rows.engages.split(':')[0], before.rows.ledger.split(':')[0]], ['7', '7', '3'], 'seed: the rows are in');
  eq(before.fp.constraints.includes('origins_spawns_pkey:PRIMARY KEY (instance)') && before.fp.constraints.includes('FOREIGN KEY (instance) REFERENCES origins_spawns(instance)'), true, 'before: the single-column key and the foreign key (the names the migration drops)');

  // ---- apply -----------------------------------------------------------------------------------------------------------------------------------
  const applyMs = timed(readFileSync(join(dir, LAYERS), 'utf8'));
  const after = { fp: fingerprint(), rows: rows(), old: oldAnswers() };
  eq(after.rows, before.rows, 'apply: every row of spawns, engages and the ledger is unchanged (but for the new layer column)');
  eq(psql(`select count(*) from public.origins_spawns where layer = 1`) + '/' + psql(`select count(*) from public.origins_spawn_engages where layer = 1`), '7/7', 'apply: every existing row is layer 1');
  eq(after.fp.constraints.includes('PRIMARY KEY (layer, instance)') && !after.fp.constraints.includes('FOREIGN KEY (instance)'), true, 'apply: the key is (layer, instance) and the foreign key is gone');
  eq(after.old.state, before.old.state, 'apply: the OLD state function answers exactly what it answered before');
  eq(JSON.parse(after.old.engageGet).layer, 1, 'apply: engage_get now carries the layer (1)');
  const { layer: _l, ...engageGetNow } = JSON.parse(after.old.engageGet);
  eq(engageGetNow, JSON.parse(before.old.engageGet), 'apply: ... and nothing else of its answer changed');
  const asWriter = sql => JSON.parse(psql(`begin; set role frankendom_verifier; select (${sql})::text; rollback;`).split('\n').find(l => l.startsWith('{')));   // run in a transaction that is rolled back: the probe leaves no row behind
  eq(asWriter(`public.origins_spawn_check('${A}', '${T(1)}', 0, 120)`).mode, 'first', 'apply: the OLD check still reads a seeded open token (layer 1)');
  eq(asWriter(`public.origins_spawn_kill('${A}', '${T(1)}', 0, 75, '[{"op":"event","event_id":"enc:${T(1)}","kind":"mob","account":"${A}","character":"${pcs[A]}","payload":{"result":"won","world":true,"beta":true}}]'::jsonb, '{"reach":"unchecked"}'::jsonb)`).result, 'killed', 'apply: the OLD kill function pays a seeded open token (layer 1) after the migration');
  eq(asWriter(`public.origins_spawn_engage_layer(2, '${B}', '${pcs[B]}', '${T(8)}', 'wolves-1', 'character:ash-wolf')`).layer, 2, 'apply: a layer-2 engage on a seeded id opens its own row');
  eq(rows(), before.rows, 'apply: the probes were rolled back, the rows are still the seeded ones');

  // ---- rollback --------------------------------------------------------------------------------------------------------------------------------
  const rollbackMs = timed(readFileSync(join(dir, '..', 'down', DOWN), 'utf8'));
  const back = { fp: fingerprint(), rows: rows(), old: oldAnswers() };
  eq(back.fp.constraints, before.fp.constraints, 'ROLLBACK: the primary keys, the foreign key (validated: no engage is orphaned) and every check are exactly as before');
  eq(psql(`select convalidated::text from pg_constraint where conname = 'origins_spawn_engages_instance_fkey'`), 'true', 'ROLLBACK: the foreign key is VALIDATED again');
  eq(back.fp.indexes, before.fp.indexes, 'ROLLBACK: every index on the three tables is exactly as before');
  eq(back.fp.columns, before.fp.columns, 'ROLLBACK: the columns are exactly as before (no layer column anywhere)');
  const lineDiff = (a, b) => { const A_ = new Set(a.split('\n')), B_ = new Set(b.split('\n')); return [...a.split('\n').filter(l => !B_.has(l)).map(l => `- ${l.slice(0, 160)}`), ...b.split('\n').filter(l => !A_.has(l)).map(l => `+ ${l.slice(0, 160)}`)]; };
  eq(lineDiff(before.fp.functions, back.fp.functions), [], 'ROLLBACK (differing functions):');
  eq(back.fp.functions, before.fp.functions, 'ROLLBACK: every spawn function (definition md5 and grants) is byte-identical to before the migration');
  eq(back.rows, before.rows, 'ROLLBACK: every row of spawns, engages and the ledger is unchanged');
  eq(back.old, before.old, 'ROLLBACK: the old state and engage_get answer exactly as before');

  // ---- apply again ---------------------------------------------------------------------------------------------------------------------------------
  psql(readFileSync(join(dir, LAYERS), 'utf8'));
  eq(fingerprint().functions, after.fp.functions, 're-apply after rollback: the same functions as the first apply');
  console.log(`origins-spawn-layers-rehearsal: ${checks} checks passed (seed: 7 spawns, 7 engages, 3 ledger rows; apply ${applyMs} ms, rollback ${rollbackMs} ms, each one transaction)`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
