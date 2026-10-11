// Migration 202610110020 (leaderboards show a stable public fighter number, not the display name) on real PostgreSQL, in a disposable socket-only cluster like career-service-database-check.mjs: no DATABASE_URL, no SUPABASE_* and no service-role key is read.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rankFor } from '../src/core/server.ts';
const root = mkdtempSync(join(tmpdir(), 'frankendom-career-service-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 120_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const as = (role, user, sql) => psql(`select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};\n${sql}\nreset role;`)
  .split('\n').filter(line => line !== '' && !/^[0-9a-f-]{36}$/.test(line)).join('\n');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
const fail = message => { throw Error(message); };
let checks = 0;
const ok = (cond, message) => { checks++; if (!cond) fail(message); };
const refused = (role, user, sql) => as(role, user, `do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when insufficient_privilege or check_violation or not_null_violation or foreign_key_violation then null; end; end$$;`) === '';
const MIG = 'supabase/migrations/202610110020_leaderboards_public_id.sql', DOWN = 'supabase/down/202610110020_leaderboards_public_id_down.sql';
const shape = `select pg_get_function_result('public.leaderboards(integer)'::regprocedure) || '/' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'fighter_profiles' and column_name = 'public_no');`;
const NEW = 'TABLE(board text, place integer, display_name text, score integer, fighter_id integer)/1', OLD = 'TABLE(board text, place integer, display_name text, score integer)/0';
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('${A}'),('${B}'),('${C}');`);
  const upTo = last => readdirSync('supabase/migrations').filter(n => n.endsWith('.sql') && n < last).sort().map(n => readFileSync(join('supabase/migrations', n), 'utf8')).join('\n');
  psql(upTo('202610110020'));
  // Profiles that exist BEFORE the migration must get a number from it.
  psql(`insert into public.fighter_profiles (user_id, display_name) values ('${A}', 'Alpha'), ('${B}', 'Bravo');
    insert into public.duel_ratings (user_id, rating) values ('${A}', 1040), ('${B}', 1100), ('${C}', 2000);
    insert into public.fight_results (user_id, kind, opponent_key, opponent_name, opponent_level, result, room) values
      ('${A}', 'duel', 'k1', 'Bravo', 1, 'win', 'room00001'), ('${A}', 'duel', 'k1', 'Bravo', 1, 'win', 'room00002'), ('${B}', 'duel', 'k2', 'Alpha', 1, 'win', 'room00003'), ('${B}', 'duel', 'k2', 'Alpha', 1, 'loss', 'room00004'), ('${C}', 'duel', 'k3', 'Alpha', 1, 'win', 'room00005');`);
  const text = readFileSync(MIG, 'utf8').split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
  ok(!/\b(truncate|delete)\b/i.test(text) && (text.match(/drop\s+\w+/gi) ?? []).join() === 'drop function' && !/\bupdate\s+public\./i.test(text), 'the migration deletes, truncates, updates rows or drops more than the old function');
  psql(readFileSync(MIG, 'utf8'));
  ok(psql(shape) === NEW, `shape after up: ${psql(shape)}`);
  const idA = psql(`select public_no from public.fighter_profiles where user_id = '${A}';`), idB = psql(`select public_no from public.fighter_profiles where user_id = '${B}';`);
  ok(/^\d+$/.test(idA) && /^\d+$/.test(idB) && idA !== idB, `existing profiles were not numbered distinctly: ${idA}, ${idB}`);
  ok(psql(`select is_nullable || '/' || is_identity from information_schema.columns where table_name = 'fighter_profiles' and column_name = 'public_no';`) === 'NO/YES', 'public_no is not a not-null identity');
  ok(psql(`select count(*) from pg_constraint where conrelid = 'public.fighter_profiles'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%public_no%';`) === '1', 'public_no is not unique');

  // The boards: numbers only. No real name and no uid anywhere in the output.
  const board = as('authenticated', C, `select board, place, display_name, score, fighter_id from public.leaderboards();`);
  ok(board === `duel_rating|1|Fighter #${idB}|1100|${idB}\nduel_rating|2|Fighter #${idA}|1040|${idA}\nduel_wins|1|Fighter #${idA}|2|${idA}\nduel_wins|2|Fighter #${idB}|1|${idB}`, `the boards read ${JSON.stringify(board)}`);
  ok(!/Alpha|Bravo|Charlie/.test(board) && ![A, B, C].some(u => board.includes(u)), 'a name or an auth uid is in the board output');
  ok(as('authenticated', C, `select count(*) from public.leaderboards(1);`) === '2' && as('authenticated', C, `select count(*) from public.leaderboards(-5);`) === '2' && as('authenticated', C, `select count(*) from public.leaderboards(1000);`) === '4', 'the limit is not clamped to 1..50');
  ok(refused('anon', null, `perform * from public.leaderboards()`), 'anon can read the boards');

  // Stable and never reused; clients cannot choose or change it.
  as('authenticated', A, `update public.fighter_profiles set display_name = 'Renamed';`);
  ok(as('authenticated', C, `select fighter_id from public.leaderboards() where board = 'duel_wins' and place = 1;`) === idA, 'a rename changed the public number');
  ok(refused('authenticated', A, `update public.fighter_profiles set public_no = 999`), 'a client changed its own public number');
  ok(refused('authenticated', C, `insert into public.fighter_profiles (user_id, display_name, public_no) values ('${C}', 'Charlie', 1)`), 'a client chose its own public number');
  as('authenticated', C, `insert into public.fighter_profiles (user_id, display_name) values ('${C}', 'Charlie');`);
  const idC = psql(`select public_no from public.fighter_profiles where user_id = '${C}';`);
  ok(Number(idC) > Math.max(Number(idA), Number(idB)), `a new fighter got ${idC}, not above ${idA}/${idB}`);
  psql(`delete from public.fighter_profiles where user_id = '${C}'; insert into public.fighter_profiles (user_id, display_name) values ('${C}', 'Charlie2');`);
  ok(Number(psql(`select public_no from public.fighter_profiles where user_id = '${C}';`)) > Number(idC), 'a deleted fighter\'s number was reused');

  // The down file restores the 0019 function and removes the column; no rows touched; the up file applies again.
  const rowsBefore = psql(`select count(*) from public.fight_results;`) + '/' + psql(`select count(*) from public.fighter_profiles;`);
  psql(readFileSync(DOWN, 'utf8'));
  ok(psql(shape) === OLD, `shape after down: ${psql(shape)}`);
  ok(as('authenticated', A, `select board, place, display_name, score from public.leaderboards();`).startsWith('duel_rating|1|'), 'the old function did not come back');
  ok(psql(`select count(*) from public.fight_results;`) + '/' + psql(`select count(*) from public.fighter_profiles;`) === rowsBefore, 'the down file touched existing rows');
  psql(readFileSync(MIG, 'utf8'));
  ok(psql(shape) === NEW, 'the up file does not apply again after the down file');
  console.log(`leaderboards public id database check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
