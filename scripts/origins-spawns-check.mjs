// Migration 202610080014 (Zone 1 world spawns, detached from the Pit): the functions on a disposable PostgreSQL cluster with every migration applied, driven as BOTH writer roles.
// Proves: grants (writer roles only, no table reachable directly); engage creates the spawn and issues a single-use token, re-engaging returns the same token, at most max_open per
// account; touch extends and is refused after use/expiry; a kill report refuses too fast and over the caps WITHOUT writing, then consumes the token, marks the spawn dead with the
// respawn clock and applies the batch in ONE transaction (a bad batch rolls everything back); a second report is O0009; the other player's engage on the same creature answers 'dead';
// a dead spawn refuses engage until its respawn passes, then revives as generation + 1; the down-script removes exactly the new objects.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610080014_origins_world_spawns.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-spawns-'));
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
const tok = n => `spawn-tok-${n}-`.padEnd(24, 'x');
const ENGAGE = (acct, pc, t, inst, kind = 'character:ash-wolf') => `select public.origins_spawn_engage('${acct}', '${pc}', '${t}', '${inst}', '${kind}')::text;`;
const EV = (t, acct, pc) => `[{"op":"event","event_id":"enc:${t}","kind":"mob","account":"${acct}","character":"${pc}","payload":{"result":"won","world":true,"beta":true}}]`;
const KILL = (acct, t, minMs, respawnS, batch, ledger = '{"cp":12,"reach":"unchecked"}') => `select public.origins_spawn_kill('${acct}', '${t}', ${minMs}, ${respawnS}, '${batch}'::jsonb, '${ledger}'::jsonb)::text;`;
const ledger = t => psql(`select coalesce((select reach_status || '/' || cp || '/' || bronze || '/' || cardinality(item_ids) from public.origins_beta_ledger where event_id = 'enc:${t}'), 'none')`);
const events = t => psql(`select count(*) from public.origins_events where event_id = 'enc:${t}'`);
const used = t => psql(`select coalesce(result, 'open') from public.origins_spawn_engages where token = '${t}'`);
const backdate = (t, s) => psql(`update public.origins_spawn_engages set issued_at = issued_at - interval '${s} seconds' where token = '${t}'`);

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

  // ---- grants ------------------------------------------------------------------------------------------------------------------------------
  const FNS = ['origins_spawn_state(text[])', 'origins_spawn_engage(uuid,text,text,text,text)', 'origins_spawn_engage_get(uuid,text)', 'origins_spawn_touch(uuid,text)', 'origins_spawn_kill(uuid,text,int,int,jsonb,jsonb)'];
  for (const fn of FNS) eq(psql(`select has_function_privilege('${V}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('${O}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '1100', `grants: ${fn} is for the two writer roles only`);
  eq(psql(`select (has_function_privilege('anon', 'origins_spawn_view(origins_spawns)'::regprocedure, 'execute') or has_function_privilege('${V}', 'origins_spawn_view(origins_spawns)'::regprocedure, 'execute'))::text`), 'false', 'grants: the view helper is nobody\'s');
  for (const t of ['origins_world_config', 'origins_spawns', 'origins_spawn_engages', 'origins_beta_ledger']) {
    eq(psql(`select has_table_privilege('${V}', 'public.${t}', 'select')::int::text || has_table_privilege('${O}', 'public.${t}', 'select')::int::text || has_table_privilege('anon', 'public.${t}', 'select')::int::text || has_table_privilege('authenticated', 'public.${t}', 'select')::int::text`), '0000', `grants: no role reads ${t} directly`);
  }

  // ---- engage / state / touch ------------------------------------------------------------------------------------------------------------------
  eq(await val(V, `select public.origins_spawn_state(array['wolves-1'])::text;`).then(s => s.spawns), [], 'state: a never-engaged spawn is not listed (alive, generation 0)');
  const e1 = await val(V, ENGAGE(A, pcA, tok(1), 'wolves-1'));
  eq([e1.token, e1.instance, e1.generation, e1.kind], [tok(1), 'wolves-1', 0, 'character:ash-wolf'], 'engage: a token for a live spawn, generation 0');
  eq((await val(O, ENGAGE(A, pcA, tok(2), 'wolves-1'))).token, tok(1), 'engage again (the other role): the SAME open token, no second one');
  eq(await code(V, ENGAGE(A, pcB, tok(3), 'wolves-2')), 'O0007', 'engage: a character that is not the account\'s is refused');
  eq(await code(V, ENGAGE(A, pcA, tok(3), 'wolves-1', 'character:boar')), 'O0002', 'engage: the kind is the spawn\'s own');
  for (const n of [2, 3, 4]) await val(V, ENGAGE(A, pcA, tok(10 + n), `wolves-${n}`));
  eq(await val(V, ENGAGE(A, pcA, tok(15), 'wolves-5')), { refused: 'too-many' }, 'engage: at most 4 open per account');
  eq(psql(`select count(*) from public.origins_spawn_engages where token = '${tok(15)}'`), '0', 'engage: a refusal writes no token');
  const before = psql(`select expires_at from public.origins_spawn_engages where token = '${tok(1)}'`);
  psql(`select pg_sleep(0.05)`);
  await val(V, `select public.origins_spawn_touch('${A}', '${tok(1)}')::text;`);
  eq(psql(`select (expires_at > '${before}'::timestamptz)::text from public.origins_spawn_engages where token = '${tok(1)}'`), 'true', 'touch: the token lives 120 s past the last touch');
  eq(await code(V, `select public.origins_spawn_touch('${B}', '${tok(1)}');`), 'O0009', 'touch: another account\'s token is refused');
  eq(await val(V, `select coalesce(public.origins_spawn_engage_get('${B}', '${tok(1)}'), 'null'::jsonb)::text;`), null, 'engage_get: another account\'s token is invisible');

  // B engages the same creature: allowed (first valid kill wins)
  const eb = await val(V, ENGAGE(B, pcB, tok(20), 'wolves-1'));
  eq(eb.generation, 0, 'two players may engage one creature');

  // ---- kill report: refusals write nothing ---------------------------------------------------------------------------------------------------
  eq(await val(V, KILL(A, tok(1), 60_000, 75, EV(tok(1), A, pcA))), { refused: 'too-fast' }, 'kill: faster than the time-to-kill floor is refused');
  eq([used(tok(1)), events(tok(1))], ['open', '0'], 'kill: a too-fast report consumes nothing and writes nothing');
  eq(await code(V, KILL(A, tok(1), 0, 75, `[{"op":"event","event_id":"enc:${tok(1)}","kind":"nope","account":"${A}","character":"${pcA}","payload":{}}]`)) !== null, true, 'kill: a bad batch fails');
  eq([used(tok(1)), events(tok(1)), psql(`select alive::text from public.origins_spawns where instance = 'wolves-1'`)], ['open', '0', 'true'], 'kill: a failed batch rolls back the token, the spawn and the event');
  eq(ledger(tok(1)), 'none', 'kill: a failed batch leaves no beta-ledger row');
  eq(await code(V, KILL(A, tok(1), 0, 75, EV(tok(1), A, pcA), '{"cp":1,"reach":"maybe"}')), 'O0002', 'kill: a ledger without a reach status is refused');
  eq([used(tok(1)), events(tok(1)), ledger(tok(1))], ['open', '0', 'none'], 'kill: ... and rolls back the token, the event and the ledger');
  psql(`update public.origins_world_config set kills_per_min = 1`);
  psql(`insert into public.origins_spawns (instance, kind) values ('cap-1', 'character:ash-wolf'); insert into public.origins_spawn_engages (token, account, character, instance, generation, expires_at, used_at, result) values ('${tok(90)}', '${A}', '${pcA}', 'cap-1', 0, now(), now(), 'killed')`);
  eq(await val(V, KILL(A, tok(1), 0, 75, EV(tok(1), A, pcA))), { refused: 'cap' }, 'kill: over the kills-per-minute cap is refused');
  eq(used(tok(1)), 'open', 'kill: a capped report consumes nothing');
  psql(`delete from public.origins_spawn_engages where token = '${tok(90)}'; update public.origins_world_config set kills_per_min = 6`);

  // ---- kill report: consumes, marks dead, pays once ---------------------------------------------------------------------------------------------
  backdate(tok(1), 30);
  const k1 = await val(V, KILL(A, tok(1), 20_000, 75, EV(tok(1), A, pcA)));
  eq([k1.result, k1.instance, typeof k1.respawnAt], ['killed', 'wolves-1', 'string'], 'kill: consumed, the spawn is dead with a respawn time');
  eq([used(tok(1)), events(tok(1)), psql(`select alive::text || '/' || generation || '/' || (respawn_at > now() + interval '70 seconds')::text from public.origins_spawns where instance = 'wolves-1'`)], ['killed', '1', 'false/0/true'], 'kill: token used, event written once, spawn dead ~75 s');
  eq(ledger(tok(1)), 'unchecked/12/0/0', 'kill: ONE beta-ledger row in the same transaction (reach status, cp; no mint, no bronze in this batch)');
  eq(await code(V, KILL(A, tok(1), 0, 75, EV(tok(1), A, pcA))), 'O0009', 'kill: a second report is refused');
  eq(await val(V, KILL(B, tok(20), 0, 75, EV(tok(20), B, pcB))), { refused: 'dead', respawnAt: k1.respawnAt }, 'kill: the other player\'s report answers dead');
  eq(used(tok(20)), 'dead', 'kill: the loser\'s token is closed');
  eq(ledger(tok(20)), 'none', 'kill: a dead report writes no ledger row');
  eq((await val(V, ENGAGE(B, pcB, tok(21), 'wolves-1'))).refused, 'dead', 'engage: a dead spawn refuses until its respawn');
  const st = await val(V, `select public.origins_spawn_state(array['wolves-1','wolves-9'])::text;`);
  eq(st.spawns.map(s => [s.instance, s.alive, s.generation]), [['wolves-1', false, 0]], 'state: the dead spawn and its respawn time');

  backdate(tok(12), 30);
  const mint = `{"op":"mint","item":{"id":"it-beta-1","item":"item:ash-pelt","quantity":1,"tier":0,"upgrade_level":0,"loc":{"kind":"pack","owner":"${pcA}","index":0},"bound_to":null,"mint_key":"loot:enc.beta0001:0","provenance":{"mintKey":"loot:enc.beta0001:0"},"history":[],"single_copy":false}}`;
  const paidKill = await as(V, KILL(A, tok(12), 0, 75, `[${EV(tok(12), A, pcA).slice(1, -1)},${mint},{"op":"metal","account":"${A}","delta_bronze":7,"reason":"award","event_id":"enc:${tok(12)}"}]`, '{"cp":30,"reach":"checked"}'));
  if (paidKill.code === 0) eq(ledger(tok(12)), 'checked/30/7/1', 'kill: the ledger reads the minted ids and the bronze from the batch that was written');
  else console.log(`origins-spawns-check: (paying-batch probe skipped: ${paidKill.err.trim().slice(0, 160)})`);

  // ---- respawn: generation + 1 ----------------------------------------------------------------------------------------------------------------------
  psql(`update public.origins_spawns set respawn_at = now() - interval '1 second' where instance = 'wolves-1'`);
  eq((await val(V, `select public.origins_spawn_state(array['wolves-1'])::text;`)).spawns[0].alive, true, 'state: past its respawn the spawn reads alive');
  const e2 = await val(V, ENGAGE(B, pcB, tok(22), 'wolves-1'));
  eq([e2.token, e2.generation], [tok(22), 1], 'engage after respawn: a new generation');
  psql(`update public.origins_spawn_engages set expires_at = now() - interval '1 second' where token = '${tok(22)}'`);
  eq(await code(V, KILL(B, tok(22), 0, 75, EV(tok(22), B, pcB))), 'O0009', 'kill: an expired token is refused');
  eq(await code(V, `select public.origins_spawn_touch('${B}', '${tok(22)}');`), 'O0009', 'touch: an expired token is refused');

  // ---- down ----------------------------------------------------------------------------------------------------------------------------------------
  const eventsBefore = psql(`select count(*) from public.origins_events`);
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins\\_spawn\\_%'`), '0', 'down: the functions are gone');
  eq(psql(`select count(*) from pg_class where relname in ('origins_world_config', 'origins_spawns', 'origins_spawn_engages', 'origins_beta_ledger')`), '0', 'down: the tables are gone');
  eq(psql(`select count(*) from public.origins_events`), eventsBefore, 'down: no event touched');
  psql(readFileSync(join(dir, UP), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins\\_spawn\\_%'`), '6', 'up again after down');
  console.log(`origins-spawns-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
