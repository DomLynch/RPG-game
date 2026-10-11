// Migration 202610110021 (the production QA account: fighter_profiles.is_test keeps it off leaderboards() and daily_board) on real PostgreSQL, in a disposable socket-only cluster like leaderboards-public-id-database-check.mjs: no DATABASE_URL, no network, no production.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'frankendom-is-test-'));
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
const MIG = 'supabase/migrations/202610110021_fighter_is_test.sql', DOWN = 'supabase/down/202610110021_fighter_is_test_down.sql';
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
  psql(upTo('202610110021'));
  psql(`insert into public.fighter_profiles (user_id, display_name) values ('${A}', 'Alpha'), ('${B}', 'Bravo'), ('${C}', 'QA');
    insert into public.duel_ratings (user_id, rating) values ('${A}', 1040), ('${B}', 1100), ('${C}', 2000);
    insert into public.fight_results (user_id, kind, opponent_key, opponent_name, opponent_level, result, room) values
      ('${A}', 'duel', 'k1', 'Bravo', 1, 'win', 'room00001'), ('${C}', 'duel', 'k3', 'Alpha', 1, 'win', 'room00002'), ('${C}', 'duel', 'k3', 'Alpha', 1, 'win', 'room00003');
    insert into public.daily_results (day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record, verified) select date '2026-09-23', user_id, 1, 'x', 'sword', 'killed', 100, null, 0, 'AAAA', true from public.fighter_profiles;`);
  const boards = `select board, place, score from public.leaderboards();`, daily = `select count(*) from public.daily_board;`;
  ok(as('authenticated', A, boards).includes('|2000'), 'precondition: the unflagged test fighter should lead before the migration');
  const text = readFileSync(MIG, 'utf8').split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
  ok(!/\b(truncate|delete)\b/i.test(text) && !/\bdrop\s+/i.test(text) && !/\bupdate\s+public\./i.test(text), 'the migration deletes, truncates, updates rows or drops something');
  psql(readFileSync(MIG, 'utf8'));
  ok(psql(`select is_nullable || '/' || column_default from information_schema.columns where table_name = 'fighter_profiles' and column_name = 'is_test';`) === 'NO/false', 'is_test is not not-null default false');
  ok(psql(`select count(*) from public.fighter_profiles where is_test;`) === '0', 'existing rows are not all false');
  ok(as('authenticated', A, daily) === '3' && as('authenticated', A, boards).includes('|2000'), 'flag off should change nothing');
  psql(`update public.fighter_profiles set is_test = true where user_id = '${C}';`);
  const after = as('authenticated', A, boards);
  ok(!after.includes('2000') && after === `duel_rating|1|1100\nduel_rating|2|1040\nduel_wins|1|1`, `a test fighter is on the boards: ${JSON.stringify(after)}`);
  ok(as('authenticated', A, daily) === '2' && as('anon', null, daily) === '2', 'a test fighter is on the daily board');
  ok(as('authenticated', C, `select count(*) from public.leaderboards();`) === '3', 'the test fighter lost access to the boards');
  ok(refused('authenticated', C, `update public.fighter_profiles set is_test = false`), 'a client cleared its own is_test');
  ok(refused('authenticated', B, `update public.fighter_profiles set is_test = true`), 'a client set its own is_test');
  ok(refused('authenticated', B, `insert into public.fighter_profiles (user_id, display_name, is_test) values ('${B}', 'x', true)`), 'a client inserted is_test');
  ok(refused('anon', null, `perform * from public.leaderboards()`), 'anon can read the boards');
  const rowsBefore = psql(`select count(*) from public.fight_results;`) + '/' + psql(`select count(*) from public.fighter_profiles;`);
  psql(readFileSync(DOWN, 'utf8'));
  ok(psql(`select count(*) from information_schema.columns where table_name = 'fighter_profiles' and column_name = 'is_test';`) === '0', 'the down file left the column');
  ok(as('authenticated', A, boards).includes('|2000') && as('authenticated', A, daily) === '3', 'the down file did not restore the old readers');
  ok(psql(`select count(*) from public.fight_results;`) + '/' + psql(`select count(*) from public.fighter_profiles;`) === rowsBefore, 'the down file touched existing rows');
  psql(readFileSync(MIG, 'utf8'));
  console.log(`fighter is_test database check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
