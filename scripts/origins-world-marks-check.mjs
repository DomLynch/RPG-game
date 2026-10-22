// Migration 20261022100000 (world marks: killing a ladder roster fighter is a ladder mark): origins_world_marks_settle and the replaced standing_of, on a disposable PostgreSQL cluster with every
// migration applied. Proves: grants (the writer role only; no table reachable); a kill inside the wait settles nothing; after the wait every account at or above `ofTop` of the TOP damage earns ONE mark and
// the rest none, and the result does not depend on the order the ledger rows were written; a settle is idempotent; only the roster instances count; zero (unverified) damage never qualifies; the cap on
// TOTAL standing marks (seed + claims + world marks) and the per-hour brake hold; standing_of counts world marks, and with before_claim only the marks created before that claim; bad arguments are refused
// (O0002); the down script restores standing_of exactly and removes exactly the new objects. The ledger rows are written directly (the table is the kill path's own, proven by origins-damage-share-check.mjs).
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '20261022100000_origins_world_marks.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-marks-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const psqlAsync = sql => new Promise(resolve => {
  const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-X', '-q', '-A', '-t'], { env });
  let out = '', err = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, out: out.trim(), err }));
  child.stdin.end(sql);
});
const [A, B, C, D] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const as = (role, sql) => psqlAsync(`set role ${role}; ${sql}`);
const code = async (role, sql) => { const r = await as(role, sql); return r.code === 0 ? null : /(O\d{4}|\b42501\b|permission denied)/.exec(r.err)?.[1] ?? r.err.trim().slice(0, 120); };
const val = async (role, sql) => { const r = await as(role, sql); if (r.code !== 0) fail(`${sql}: ${r.err.trim().slice(0, 200)}`); return r.out.split('\n').pop(); };
const O = 'frankendom_origins', V = 'frankendom_verifier';
// settle(wait, ofTop, cap, perHour, instances, limit)
const SETTLE = (w, o, c, h, inst, n = 50) => `select public.origins_world_marks_settle(${w}, ${o}, ${c}, ${h}, array[${inst.map(i => `'${i}'`).join(',')}]::text[], ${n});`;
const ledger = (tokenNo, instance, gen, account, damage, agoS = 1000, layer = 1) => `insert into public.origins_spawn_damage (token, instance, generation, account, damage, joined, at, layer) values ('${`marks-tok-${tokenNo}-`.padEnd(24, 'x')}', '${instance}', ${gen}, '${account}', ${damage}, false, now() - interval '${agoS} seconds', ${layer});`;
const marksOf = account => psql(`select count(*) from public.origins_world_marks where user_id = '${account}'`);
const standing = (account, claim = 'null') => psql(`select marks from public.standing_of('${account}', ${claim})`);
const settled = () => psql(`select count(*) from public.origins_world_marks_settled`);

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
    insert into auth.users values ('${A}'), ('${B}'), ('${C}'), ('${D}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  psql(files.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));

  // ---- grants -----------------------------------------------------------------------------------------------------------------------------------
  const FN = 'origins_world_marks_settle(int,numeric,int,int,text[],int)';
  eq(['public.' + FN].map(f => psql(`select has_function_privilege('${O}', '${f}'::regprocedure, 'execute')::int::text || has_function_privilege('${V}', '${f}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${f}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${f}'::regprocedure, 'execute')::int::text`)), ['1000'], 'grants: the writer role alone can settle');
  for (const t of ['origins_world_marks', 'origins_world_marks_settled']) eq(['select', 'insert'].map(p => psql(`select has_table_privilege('${O}', 'public.${t}', '${p}')::int::text || has_table_privilege('${V}', 'public.${t}', '${p}')::int::text || has_table_privilege('anon', 'public.${t}', '${p}')::int::text || has_table_privilege('authenticated', 'public.${t}', '${p}')::int::text`)), ['0000', '0000'], `grants: ${t} is reachable through the function only`);
  eq(await code('anon', SETTLE(0, 0.5, 9, 6, ['roster-1'])), '42501', 'grants: anon cannot settle');
  eq(await code(V, SETTLE(0, 0.5, 9, 6, ['roster-1'])), '42501', 'grants: the verifier cannot settle');

  // ---- bad arguments ----------------------------------------------------------------------------------------------------------------------------
  for (const [what, sql] of [['of_top 0', SETTLE(0, 0, 9, 6, ['r'])], ['of_top above 1', SETTLE(0, 1.5, 9, 6, ['r'])], ['per_hour 0', SETTLE(0, 0.5, 9, 0, ['r'])], ['cap -1', SETTLE(0, 0.5, -1, 6, ['r'])], ['limit 0', SETTLE(0, 0.5, 9, 6, ['r'], 0)], ['wait -1', SETTLE(-1, 0.5, 9, 6, ['r'])]]) eq(await code(O, sql), 'O0002', `bad arguments: ${what}`);

  // ---- inside the wait: nothing is settled -----------------------------------------------------------------------------------------------------
  psql(ledger(1, 'roster-1', 0, A, 100, 10) + ledger(2, 'roster-1', 0, B, 80, 5));
  eq(await val(O, SETTLE(125, 0.5, 9, 6, ['roster-1'])), '0', 'a kill younger than the wait is not settled');
  eq([settled(), marksOf(A), marksOf(B)], ['0', '0', '0'], '... and nothing is written');
  psql(`delete from public.origins_spawn_damage`);

  // ---- the qualify rule: relative to the TOP, order-free ---------------------------------------------------------------------------------------
  psql(ledger(10, 'roster-1', 0, A, 100) + ledger(11, 'roster-1', 0, B, 50) + ledger(12, 'roster-1', 0, C, 49.9) + ledger(13, 'roster-1', 0, D, 0));   // A top; B exactly half qualifies; C just under; D unverified
  eq(await val(O, SETTLE(125, 0.5, 9, 6, ['roster-1'])), '2', 'A (top) and B (exactly half of the top) earn a mark; C (under half) and D (zero damage) do not');
  eq([marksOf(A), marksOf(B), marksOf(C), marksOf(D), settled()], ['1', '1', '0', '0', '1'], '... one row each, the incarnation recorded as settled');
  eq(psql(`select damage || '/' || top from public.origins_world_marks where user_id = '${B}'`), '50/100', '... the mark keeps the damage and the top it was decided on');
  eq(await val(O, SETTLE(125, 0.5, 9, 6, ['roster-1'])), '0', 'idempotent: a second settle writes nothing');
  // the same ledger in the REVERSE order, a later generation: the same qualifiers (the decision never reads who reported first)
  psql(ledger(20, 'roster-1', 1, D, 0) + ledger(21, 'roster-1', 1, C, 49.9) + ledger(22, 'roster-1', 1, B, 50) + ledger(23, 'roster-1', 1, A, 100));
  eq(await val(O, SETTLE(125, 0.5, 99, 99, ['roster-1'])), '2', 'order-free: the reversed ledger qualifies the same two');
  eq([marksOf(A), marksOf(B), marksOf(C)], ['2', '2', '0'], '... one more mark each');
  // a tiny first reporter alone earns, a big one arriving later cannot take it away: the decision waited for the whole ledger
  psql(ledger(30, 'roster-1', 2, C, 1) + ledger(31, 'roster-1', 2, A, 100));
  eq(await val(O, SETTLE(125, 0.5, 99, 99, ['roster-1'])), '1', 'a first reporter with 1 damage against a top of 100 earns nothing (only A does)');
  eq([marksOf(A), marksOf(C)], ['3', '0'], '...');

  // ---- only the roster instances count ----------------------------------------------------------------------------------------------------------
  psql(ledger(40, 'wolves-1', 0, A, 100) + ledger(41, 'roster-2', 0, B, 100));
  eq(await val(O, SETTLE(125, 0.5, 99, 99, ['roster-2'])), '1', 'a creature not in the roster list (wolves-1) is no ladder win');
  eq([marksOf(A), marksOf(B), psql(`select count(*) from public.origins_world_marks_settled where instance = 'wolves-1'`)], ['3', '3', '0'], '... and is not even marked settled');
  eq(await val(O, SETTLE(125, 0.5, 99, 99, [])), '0', 'an empty roster list settles nothing');

  // ---- the layer is part of the kill: the same instance and generation in two layers are two kills -------------------------------------------------
  psql(ledger(50, 'roster-3', 0, A, 100, 1000, 1) + ledger(51, 'roster-3', 0, A, 100, 1000, 2));
  eq(await val(O, SETTLE(125, 0.5, 99, 99, ['roster-3'])), '2', 'two layers of one creature are two kills, one mark each');

  // ---- the cap on TOTAL marks and the per-hour brake -------------------------------------------------------------------------------------------
  psql(`insert into public.account_seed (user_id, marks, owned) values ('${C}', 2, '[]'); delete from public.origins_spawn_damage;`);   // C has 2 marks from the seed
  eq(standing(C), '2', 'standing_of: the seed marks');
  psql(ledger(60, 'roster-4', 0, C, 100) + ledger(61, 'roster-4', 0, D, 100));
  eq(await val(O, SETTLE(125, 0.5, 2, 99, ['roster-4'])), '1', 'cap 2 total marks: C (already at 2) earns none, D (0) earns one');
  eq([marksOf(C), marksOf(D), standing(D)], ['0', '1', '1'], '... and standing_of counts the world mark');
  psql(ledger(62, 'roster-5', 0, D, 100) + ledger(63, 'roster-6', 0, D, 100));
  eq(await val(O, SETTLE(125, 0.5, 99, 2, ['roster-5', 'roster-6'])), '1', 'per hour 2: D (already 1 this hour) earns ONE more of the two kills, then the hour is full');
  eq(marksOf(D), '2', '...');
  psql(`update public.origins_world_marks set created_at = now() - interval '2 hours' where user_id = '${D}'`);
  psql(ledger(64, 'roster-7', 0, D, 100));
  eq(await val(O, SETTLE(125, 0.5, 99, 2, ['roster-7'])), '1', 'marks older than an hour no longer count against the brake');

  // ---- standing_of: world marks with before_claim ------------------------------------------------------------------------------------------------
  psql(`insert into public.loot_claims (user_id, opponent, piece, record, verified, created_at) values ('${A}', 'wolf', null, 'recordone', true, now() - interval '30 minutes');`);
  const claim = psql(`select id from public.loot_claims where user_id = '${A}'`);
  eq(standing(A), String(1 + Number(marksOf(A))), 'standing_of: a verified claim plus the world marks');
  psql(`update public.origins_world_marks set created_at = now() - interval '1 hour' where user_id = '${A}' and instance = 'roster-1' and generation = 0; update public.origins_world_marks set created_at = now() where user_id = '${A}' and not (instance = 'roster-1' and generation = 0);`);
  eq(standing(A, claim), '1', 'with before_claim: only the world marks created BEFORE that claim count (the claim itself and the later marks do not)');
  eq(psql(`select owned from public.standing_of('${A}', null)`), '[]', 'the owned list is unchanged');

  // ---- the down script restores standing_of and removes exactly the new objects -----------------------------------------------------------------
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname = 'origins_world_marks_settle'`) + '/' + psql(`select count(*) from pg_class where relname in ('origins_world_marks', 'origins_world_marks_settled')`), '0/0', 'down: the function and both tables are gone');
  eq(standing(A), '1', 'down: standing_of is the old one again (claims and seed only, no world marks)');
  eq(psql(`select count(*) from pg_proc where proname = 'standing_of'`), '1', '... still one standing_of');
  console.log(`origins-world-marks-check: ${checks} checks passed`);
} finally {
  if (started) { try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already stopped */ } }
  rmSync(root, { recursive: true, force: true });
}
