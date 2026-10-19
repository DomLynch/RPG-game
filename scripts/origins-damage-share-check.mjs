// Migration 20261019150000 (kill credit by damage): origins_spawn_check, origins_spawn_damage_read and origins_spawn_kill_v2 on a disposable PostgreSQL cluster with every migration applied, driven as the
// writer's two roles. Proves: grants (writer roles only, no table reachable); check is READ-ONLY and mirrors the kill's refusals (dead, too-fast, cap) and says 'first' or 'join'; a first v2 kill kills the
// creature exactly as origins_spawn_kill does and writes a damage row; a join kill (a token issued before the kill, inside the respawn window and the join window) pays its own batch, leaves the spawn row
// untouched and writes its own ledger and damage rows; a token issued after the kill, a join past the window, and a join after the respawn are all refused 'dead' and close the token; the batch allowlist and
// the ledger reach rule hold; the down script removes exactly the new objects. The old origins_spawn_kill is untouched (scripts/origins-spawns-check.mjs keeps proving it).
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '20261019150000_origins_damage_share.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-share-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const psqlAsync = sql => new Promise(resolve => {
  const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-X', '-q', '-A', '-t'], { env });
  let out = '', err = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, out: out.trim(), err }));
  child.stdin.end(sql);
});
const [A, B] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const as = (role, sql) => psqlAsync(`set role ${role}; ${sql}`);
const val = async (role, sql) => { const r = await as(role, sql); if (r.code !== 0) fail(`${sql}: ${r.err.trim().slice(0, 200)}`); return JSON.parse(r.out.split('\n').pop()); };
const code = async (role, sql) => { const r = await as(role, sql); return r.code === 0 ? null : /(O\d{4}|\b42501\b|permission denied)/.exec(r.err)?.[1] ?? r.err.trim().slice(0, 120); };
const tok = n => `share-tok-${n}-`.padEnd(24, 'x');
const ENGAGE = (acct, pc, t, inst) => `select public.origins_spawn_engage('${acct}', '${pc}', '${t}', '${inst}', 'character:ash-wolf')::text;`;
const EV = (t, acct, pc) => `[{"op":"event","event_id":"enc:${t}","kind":"mob","account":"${acct}","character":"${pc}","payload":{"result":"won","world":true,"beta":true}}]`;
const CHECK = (acct, t, minMs = 0, joinS = 120) => `select public.origins_spawn_check('${acct}', '${t}', ${minMs}, ${joinS})::text;`;
const KILL2 = (acct, t, batch, damage, minMs = 0, joinS = 120, ledger = '{"reach":"unchecked"}') => `select public.origins_spawn_kill_v2('${acct}', '${t}', ${minMs}, 75, '${batch}'::jsonb, '${ledger}'::jsonb, ${damage}, ${joinS})::text;`;
const DAMAGE = (inst, gen) => `select public.origins_spawn_damage_read('${inst}', ${gen})::text;`;
const ledger = t => psql(`select coalesce((select reach_status || '/' || cp || '/' || bronze || '/' || cardinality(item_ids) from public.origins_beta_ledger where event_id = 'enc:${t}'), 'none')`);
const events = t => psql(`select count(*) from public.origins_events where event_id = 'enc:${t}'`);
const used = t => psql(`select coalesce(result, 'open') from public.origins_spawn_engages where token = '${t}'`);
const backdate = (t, s) => psql(`update public.origins_spawn_engages set issued_at = issued_at - interval '${s} seconds' where token = '${t}'`);
const spawnRow = i => psql(`select alive::text || '/' || generation || '/' || coalesce(killed_by::text, '-') || '/' || coalesce(respawn_at::text, '-') from public.origins_spawns where instance = '${i}'`);

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
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  psql(files.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}');`);
  const mk = (account, name) => psql(`set role frankendom_origins; select public.origins_create_character('${account}', '${name}');`).split('\n').pop();
  const [pcA, pcB] = [mk(A, 'Aria'), mk(B, 'Bran')];
  const V = 'frankendom_verifier', O = 'frankendom_origins';

  // ---- grants ---------------------------------------------------------------------------------------------------------------------------------
  const FNS = ['origins_spawn_check(uuid,text,int,int)', 'origins_spawn_damage_read(text,int)', 'origins_spawn_kill_v2(uuid,text,int,int,jsonb,jsonb,numeric,int)'];
  for (const fn of FNS) eq(psql(`select has_function_privilege('${V}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('${O}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '1100', `grants: ${fn} is the writer roles' only`);
  eq(psql(`select has_table_privilege('${V}', 'public.origins_spawn_damage', 'select')::int::text || has_table_privilege('${O}', 'public.origins_spawn_damage', 'select')::int::text || has_table_privilege('anon', 'public.origins_spawn_damage', 'select')::int::text || has_table_privilege('authenticated', 'public.origins_spawn_damage', 'select')::int::text`), '0000', 'grants: the damage table is reachable by no role');
  eq(await code('anon', CHECK(A, tok(1))), '42501', 'grants: anon cannot call check');

  // ---- wolves-1: B engaged first, then A; A kills first, B joins ------------------------------------------------------------------------------
  await val(V, ENGAGE(B, pcB, tok(2), 'wolves-1'));
  await val(V, ENGAGE(A, pcA, tok(1), 'wolves-1'));
  backdate(tok(1), 30); backdate(tok(2), 30);
  eq(await val(V, CHECK(A, tok(1))), { ok: true, mode: 'first', instance: 'wolves-1', generation: 0 }, 'check: a live creature is a first kill');
  eq(await val(V, CHECK(A, tok(1), 60_000)), { refused: 'too-fast' }, 'check: mirrors the time-to-kill floor');
  eq(await code(V, CHECK(A, tok(99))), 'O0009', 'check: an unknown token');
  eq(await code(V, CHECK(B, tok(1))), 'O0009', 'check: another account\'s token is not open to it');
  eq([used(tok(1)), events(tok(1)), spawnRow('wolves-1')], ['open', '0', 'true/0/-/-'], 'check: READ-ONLY, it consumed and wrote nothing');
  eq(await val(V, KILL2(A, tok(1), EV(tok(1), A, pcA), 42.5, 60_000)), { refused: 'too-fast' }, 'v2: the time floor refuses and writes nothing');
  eq(await code(V, KILL2(A, tok(1), `[{"op":"character_set","account":"${A}"}]`, 10)), 'O0002', 'v2: the batch allowlist holds');
  eq(await code(V, KILL2(A, tok(1), EV(tok(1), A, pcA), 10, 0, 120, '{"reach":"maybe"}')), 'O0002', 'v2: the ledger reach rule holds');
  eq([used(tok(1)), events(tok(1)), ledger(tok(1)), spawnRow('wolves-1')], ['open', '0', 'none', 'true/0/-/-'], 'v2: every refusal rolled everything back');
  const k1 = await val(V, KILL2(A, tok(1), EV(tok(1), A, pcA), 42.5));
  eq([k1.result, k1.instance, k1.joined], ['killed', 'wolves-1', false], 'v2: a first kill kills the creature, not joined');
  eq([used(tok(1)), events(tok(1)), ledger(tok(1))], ['killed', '1', 'unchecked/0/0/0'], 'v2: token used, event once, one ledger row');
  const dead = spawnRow('wolves-1');
  eq(dead.startsWith('false/0/' + A), true, 'v2: the spawn is dead at its generation, killed by A');
  eq(await val(V, DAMAGE('wolves-1', 0)), [{ token: tok(1), damage: 42.5, joined: false }], 'damage_read: the first kill\'s damage');

  eq(await val(V, CHECK(B, tok(2))), { ok: true, mode: 'join', instance: 'wolves-1', generation: 0 }, 'check: a token issued before the kill, inside the windows, is a join');
  eq(await val(V, CHECK(B, tok(2), 0, 0)), { refused: 'dead', respawnAt: k1.respawnAt }, 'check: a join window of 0 s refuses');
  const kj = await val(O, KILL2(B, tok(2), EV(tok(2), B, pcB), 100));
  eq([kj.result, kj.joined, kj.respawnAt], ['killed', true, k1.respawnAt], 'v2: the join kill pays, joined, the respawn clock is the first kill\'s');
  eq(spawnRow('wolves-1'), dead, 'v2: the join left the spawn row byte-identical');
  eq([used(tok(2)), events(tok(2)), ledger(tok(2))], ['killed', '1', 'unchecked/0/0/0'], 'v2: the join has its own token, event and ledger row');
  eq(await val(V, DAMAGE('wolves-1', 0)), [{ token: tok(1), damage: 42.5, joined: false }, { token: tok(2), damage: 100, joined: true }], 'damage_read: both contributions, oldest first');
  eq(await val(V, DAMAGE('wolves-1', 1)), [], 'damage_read: another incarnation is empty');
  eq(await code(V, KILL2(B, tok(2), EV(tok(2), B, pcB), 5)), 'O0009', 'v2: a second report on a used token is refused');

  // ---- wolves-2: the refusals of a join ---------------------------------------------------------------------------------------------------------
  await val(V, ENGAGE(B, pcB, tok(3), 'wolves-2')); await val(V, ENGAGE(A, pcA, tok(4), 'wolves-2'));
  await val(V, KILL2(A, tok(4), EV(tok(4), A, pcA), 10));
  psql(`update public.origins_spawn_engages set issued_at = (select killed_at + interval '1 second' from public.origins_spawns where instance = 'wolves-2') where token = '${tok(3)}'`);   // issued AFTER the kill
  eq((await val(V, CHECK(B, tok(3)))).refused, 'dead', 'check: a token issued after the kill cannot join');
  eq((await val(V, KILL2(B, tok(3), EV(tok(3), B, pcB), 10))).refused, 'dead', 'v2: ... and is refused');
  eq([used(tok(3)), events(tok(3)), ledger(tok(3))], ['dead', '0', 'none'], 'v2: ... closing the token, writing no event and no ledger row');

  await val(V, ENGAGE(B, pcB, tok(5), 'wolves-3')); await val(V, ENGAGE(A, pcA, tok(6), 'wolves-3'));
  backdate(tok(5), 30);
  await val(V, KILL2(A, tok(6), EV(tok(6), A, pcA), 10));
  psql(`update public.origins_spawns set killed_at = killed_at - interval '200 seconds' where instance = 'wolves-3'`);
  eq((await val(V, CHECK(B, tok(5)))).refused, 'dead', 'check: past the join window (120 s) a token cannot join');
  psql(`update public.origins_spawns set killed_at = now() - interval '5 seconds', respawn_at = now() - interval '1 second' where instance = 'wolves-3'`);
  eq((await val(V, CHECK(B, tok(5)))).refused, 'dead', 'check: after the respawn time a token cannot join, whatever the window');
  eq((await val(V, KILL2(B, tok(5), EV(tok(5), B, pcB), 10))).refused, 'dead', 'v2: ... and the kill refuses too');

  // ---- the cap mirrors the kill's ---------------------------------------------------------------------------------------------------------------
  await val(V, ENGAGE(B, pcB, tok(7), 'wolves-4'));
  psql(`update public.origins_world_config set kills_per_min = 1`);
  eq((await val(V, CHECK(B, tok(7)))).refused, 'cap', 'check: over the kills-per-minute cap');
  eq((await val(V, KILL2(B, tok(7), EV(tok(7), B, pcB), 10))).refused, 'cap', 'v2: the same');
  psql(`update public.origins_world_config set kills_per_min = 6`);

  // ---- the old function is untouched, the down script removes exactly the new objects -----------------------------------------------------------
  eq(psql(`select count(*) from pg_proc where proname = 'origins_spawn_kill'`), '1', 'origins_spawn_kill is still there');
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname in ('origins_spawn_check', 'origins_spawn_damage_read', 'origins_spawn_kill_v2')`) + '/' + psql(`select count(*) from pg_class where relname = 'origins_spawn_damage'`) + '/' + psql(`select count(*) from pg_proc where proname = 'origins_spawn_kill'`), '0/0/1', 'down: exactly the new objects are gone');
  console.log(`origins-damage-share-check: ${checks} checks passed`);
} finally {
  if (started) { try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already stopped */ } }
  rmSync(root, { recursive: true, force: true });
}
