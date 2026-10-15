// Migration 20261015120000 (ground loot takes): the functions on a disposable PostgreSQL cluster with every migration applied, driven as BOTH writer roles.
// Proves: grants (writer roles only, no table reachable directly); a first take claims, mints once and commits in ONE transaction; a second take inside the window answers 'taken' WITHOUT writing;
// a stale claim number, a wrong mint key, two mints, a non-event/mint op and a bad instance are refused (O0002) and write nothing; after the window a take with the next claim number works and mints
// under a new key; two concurrent takes with the same claim number: exactly one wins; a retried take (same key) mints nothing twice; the down script removes exactly the new objects.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '20261015120000_origins_ground_takes.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-ground-'));
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
  const V = 'frankendom_verifier', O = 'frankendom_origins', INST = 'ground:zone1.rusty-sword-1';

  const keyOf = (inst, acct, n) => psql(`select 'loot:ground.' || substr(encode(sha256(convert_to('${inst}|${acct}|${n}', 'UTF8')), 'hex'), 1, 32) || ':0'`);
  const batch = (acct, pc, inst, n, slot = 0, key = keyOf(inst, acct, n)) => JSON.stringify([
    { op: 'event', event_id: `ground:${key}`, kind: 'mint', account: acct, character: pc, payload: { ground: { instance: inst, n } } },
    { op: 'mint', item: { id: `inst:${key.replace(/[^a-z0-9]/g, '-')}`, item: 'item:ash-pelt', quantity: 1, tier: 0, upgrade_level: 0, loc: { kind: 'pack', owner: pc, index: slot }, bound_to: pc, mint_key: key, provenance: { kind: 'loot', mintKey: key, at: '2026-10-15T00:00:00Z' }, history: [], single_copy: false } },
  ]);
  const TAKE = (acct, inst, n, respawnS, b) => `select public.origins_ground_take('${acct}', '${inst}', ${n}, ${respawnS}, '${b}'::jsonb)::text;`;
  const STATE = (acct, insts) => `select public.origins_ground_state('${acct}', array[${insts.map(i => `'${i}'`).join(',')}])::text;`;
  const minted = pc => psql(`select count(*) from public.origins_items where mint_key like 'loot:ground.%' and loc_owner = '${pc}'`);

  // grants: both writer roles run the functions; the table is reachable by neither, nor by anon / authenticated
  for (const role of [O, V]) eq(await code(role, STATE(A, [INST])), null, `grants: ${role} reads the claims`);
  eq(await code(O, 'select * from public.origins_ground_takes;'), '42501', 'grants: the origins role cannot read the table');
  eq(await code('authenticated', STATE(A, [INST])), '42501', 'grants: an authenticated client cannot call the state function');
  eq(await code('anon', TAKE(A, INST, 1, 3600, batch(A, pcA, INST, 1))), '42501', 'grants: anon cannot take');

  // state: no claim yet
  eq((await val(O, STATE(A, [INST]))).takes, [], 'state: a never-taken instance has no claim');
  // refused before anything is written
  eq(await code(O, TAKE(A, INST, 2, 3600, batch(A, pcA, INST, 2))), 'O0002', 'take: a first take must be claim number 1 (stale otherwise)');
  eq(await code(O, TAKE(A, 'not-ground', 1, 3600, batch(A, pcA, INST, 1))), 'O0002', 'take: a bad instance id is refused');
  eq(await code(O, TAKE(A, INST, 1, 3600, batch(A, pcA, INST, 1, 0, 'loot:ground.wrongkey000:0'))), 'O0002', 'take: a mint under any other key is refused');
  eq(await code(O, TAKE(A, INST, 1, 3600, JSON.stringify([{ op: 'metal', account: A, delta_bronze: 5, reason: 'award', event_id: 'x' }]))), 'O0002', 'take: only event and mint ops ride a ground take');
  eq(await code(O, TAKE(A, INST, 1, 3600, JSON.stringify([...JSON.parse(batch(A, pcA, INST, 1)), JSON.parse(batch(A, pcA, INST, 1))[1]]))), 'O0002', 'take: exactly one mint');
  eq([psql(`select count(*) from public.origins_ground_takes`), minted(pcA)], ['0', '0'], 'refusals write nothing');

  // the first take: claim, mint and event together
  const t1 = await val(O, TAKE(A, INST, 1, 3600, batch(A, pcA, INST, 1)));
  eq([t1.result, t1.n], ['taken', 1], 'take: the first take is accepted as claim 1');
  eq([minted(pcA), psql(`select n from public.origins_ground_takes where account = '${A}'`)], ['1', '1'], 'take: one item minted and the claim recorded');
  eq((await val(V, STATE(A, [INST]))).takes.map(t => [t.instance, t.n]), [[INST, 1]], 'state: the claim is visible');
  // inside the window: refused, nothing written
  const t2 = await val(O, TAKE(A, INST, 2, 3600, batch(A, pcA, INST, 2, 1)));
  eq(t2.refused, 'taken', 'take: a second take inside the window answers taken');
  eq([minted(pcA), psql(`select n from public.origins_ground_takes where account = '${A}'`)], ['1', '1'], 'taken: nothing was written');
  // a retried take of claim 1 (a lost response): stale, and it mints nothing twice
  eq(await code(O, TAKE(A, INST, 1, 3600, batch(A, pcA, INST, 1))), 'O0002', 'retry: the same claim number again is stale');
  eq(minted(pcA), '1', 'retry: still one item');
  // another account is independent
  eq((await val(O, TAKE(B, INST, 1, 3600, batch(B, pcB, INST, 1)))).result, 'taken', 'per account: B takes the same instance independently');
  // after the window: the next claim number works, under a new key
  psql(`update public.origins_ground_takes set taken_at = taken_at - interval '2 hours' where account = '${A}'`);
  const t3 = await val(O, TAKE(A, INST, 2, 3600, batch(A, pcA, INST, 2, 1)));
  eq([t3.result, t3.n], ['taken', 2], 'respawn: after the window the next claim works');
  eq([minted(pcA), keyOf(INST, A, 1) === keyOf(INST, A, 2)], ['2', false], 'respawn: a second item under a different key');
  // concurrency: two takes with the same expected n for a fresh instance, exactly one wins
  const I2 = 'ground:zone1.race-1', [r1, r2] = await Promise.all([as(O, TAKE(A, I2, 1, 3600, batch(A, pcA, I2, 1, 2))), as(O, TAKE(A, I2, 1, 3600, batch(A, pcA, I2, 1, 3)))]);
  eq([r1, r2].map(r => r.code === 0 ? 'won' : /O0002/.test(r.err) ? 'stale' : r.err.trim().slice(0, 120)).sort(), ['stale', 'won'], 'race: exactly one of two concurrent takes wins, the other is stale');
  eq(psql(`select count(*) from public.origins_items where mint_key = '${keyOf(I2, A, 1)}'`), '1', 'race: the key was minted once');

  // down: the new objects go, nothing else
  psql(readFileSync(join(dir, '..', 'down', '20261015120000_origins_ground_takes_down.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_ground_take(uuid,text,integer,integer,jsonb)') is null and to_regprocedure('public.origins_ground_state(uuid,text[])') is null and to_regclass('public.origins_ground_takes') is null)::text`), 'true', 'down: the functions and the table are gone');
  eq(psql(`select (to_regprocedure('public.origins_apply(jsonb,uuid[])') is not null)::text`), 'true', 'down: origins_apply is untouched');
  console.log(`origins-ground-check: ${checks} checks passed`);
} catch (e) {
  console.error(`origins-ground-check FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already stopped */ }
  rmSync(root, { recursive: true, force: true });
}
