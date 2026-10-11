// Migration 202610110019 (core slice 2b, one career service) on real PostgreSQL, in the same disposable socket-only cluster as duel-antifarm-database-check.mjs:
// no DATABASE_URL, no SUPABASE_* and no service-role key is read, so it cannot reach a hosted project. Every migration is applied in order, then:
// the ladder rows equal rankFor and no client can change them; the scorecard is a read of fight_results plus own-row notes; trials are own-row; the boards expose names and
// numbers only, count agreed duel wins (never AI rows), clamp the limit and answer a signed-in client only; the down file removes exactly what the up file made and the up file applies again.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rankFor } from '../src/core/career-ladder.ts';
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
const MIG = 'supabase/migrations/202610110019_career_service_rows.sql', DOWN = 'supabase/down/202610110019_career_service_rows_down.sql';
const objects = `select (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('pit_ladder', 'scorecard_notes', 'control_trials'))::text || '/' || (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('scorecard_rows', 'leaderboards'))::text;`;
let started = false;
try {
  // Additive only: the file may only create, insert into its own new table, and comment.
  const text = readFileSync(MIG, 'utf8').split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
  ok(!/\b(drop|truncate|delete|alter\s+table)\b/i.test(text.replace(/on delete cascade/g, '').replace(/alter table public\.(pit_ladder|scorecard_notes|control_trials) enable row level security/g, '')), 'the migration is not additive');
  ok(!/\bupdate\s+public\./i.test(text.replace(/for update to authenticated/g, '').replace(/grant update/g, '')), 'the migration updates rows');
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
  psql(readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join('supabase/migrations', n), 'utf8')).join('\n'));

  // (1) the ladder row equals the rule, for every level, and is read-only to clients.
  const rows = psql(`select level, title, numeral, label from public.pit_ladder order by level;`).split('\n');
  ok(rows.length === 50, `pit_ladder has ${rows.length} rows, not 50`);
  rows.forEach((row, i) => { const r = rankFor(i); ok(row === `${i + 1}|${r.title}|${r.numeral}|${r.label}`, `pit_ladder level ${i + 1} is ${row}, rankFor says ${r.label}`); });
  ok(as('anon', null, `select count(*) from public.pit_ladder;`) === '50', 'anon cannot read the ladder');
  for (const [role, user] of [['anon', null], ['authenticated', A]]) {
    ok(refused(role, user, `insert into public.pit_ladder values (51, 'X', 'I', 'X I')`), `${role} can insert a ladder row`);
    ok(refused(role, user, `update public.pit_ladder set title = 'X'`), `${role} can update the ladder`);
    ok(refused(role, user, `delete from public.pit_ladder`), `${role} can delete the ladder`);
  }

  // (2) the scorecard is a read of fight_results (ranks folded) plus own-row notes.
  const fight = (user, key, result) => as('authenticated', user, `insert into public.fight_results (kind, opponent_key, opponent_name, opponent_level, result) values ('ai', '${key}', 'Goblin', 3, '${result}');`);
  fight(A, 'goblin-3', 'win'); fight(A, 'goblin-4', 'loss'); fight(A, 'goblin-4', 'draw'); fight(A, 'veteran-1', 'win'); fight(B, 'goblin-1', 'win');
  ok(as('authenticated', A, `select opponent, fights, wins, losses, draws, left_count, last from public.scorecard_rows();`) === 'goblin|3|1|1|1|0|{}\nveteran|1|1|0|0|0|{}', 'the scorecard is not the fighter\'s own results folded by opponent');
  as('authenticated', A, `insert into public.scorecard_notes (opponent, left_count, last) values ('goblin', 1, array['Dropped guard late', 'Overreached']);`);
  as('authenticated', A, `update public.scorecard_notes set left_count = 2 where opponent = 'goblin';`);
  ok(as('authenticated', A, `select opponent, left_count, last from public.scorecard_rows() where opponent = 'goblin';`) === 'goblin|2|{"Dropped guard late",Overreached}', 'notes do not join the scorecard row');
  ok(as('authenticated', B, `select count(*) from public.scorecard_notes;`) === '0' && as('authenticated', B, `select opponent, fights from public.scorecard_rows();`) === 'goblin|1', 'a fighter sees another fighter\'s scorecard or notes');
  ok(refused('authenticated', B, `insert into public.scorecard_notes (user_id, opponent) values ('${A}', 'x')`), 'a fighter can write another fighter\'s note');
  ok(refused('authenticated', A, `insert into public.scorecard_notes (opponent, last) values ('wolf', array['a','b','c'])`), 'three autopsy lines were accepted');
  ok(refused('authenticated', A, `insert into public.scorecard_notes (opponent, left_count) values ('wolf', -1)`), 'a negative walk-away count was accepted');
  ok(refused('authenticated', A, `insert into public.scorecard_notes (opponent) values ('Bad Name')`), 'a malformed opponent id was accepted');
  ok(refused('authenticated', A, `update public.scorecard_notes set user_id = '${B}'`), 'a note moved to another fighter');
  ok(refused('anon', null, `perform * from public.scorecard_rows()`), 'anon can call scorecard_rows');

  // (3) trials: own-row, bounded.
  as('authenticated', A, `insert into public.control_trials (fights, wins, rematches, ticks, dealt, taken, active_ms) values (5, 3, 1, 9000, 40, 22, 120000);`);
  as('authenticated', A, `update public.control_trials set fights = 6, wins = 4, updated_at = now();`);
  ok(as('authenticated', A, `select fights, wins, rematches, ticks, dealt, taken, active_ms from public.control_trials;`) === '6|4|1|9000|40|22|120000', 'the trial tally did not round-trip');
  ok(as('authenticated', B, `select count(*) from public.control_trials;`) === '0', 'a fighter reads another fighter\'s trials');
  ok(refused('authenticated', B, `insert into public.control_trials (user_id, fights) values ('${A}', 1)`), 'a fighter can write another fighter\'s trials');
  ok(refused('authenticated', B, `insert into public.control_trials (fights, wins) values (1, 2)`), 'more wins than fights was accepted');
  ok(refused('anon', null, `perform * from public.control_trials`), 'anon can read trials');

  // (4) boards: names and numbers only; agreed duel wins, never AI rows; named fighters only; the limit is clamped.
  psql(`insert into public.fighter_profiles (user_id, display_name) values ('${A}', 'Alpha'), ('${B}', 'Bravo');
    insert into public.duel_ratings (user_id, rating) values ('${A}', 1040), ('${B}', 1100), ('${C}', 2000);
    insert into public.fight_results (user_id, kind, opponent_key, opponent_name, opponent_level, result, room) values
      ('${A}', 'duel', 'k1', 'Bravo', 1, 'win', 'room00001'), ('${A}', 'duel', 'k1', 'Bravo', 1, 'win', 'room00002'), ('${B}', 'duel', 'k2', 'Alpha', 1, 'win', 'room00003'), ('${B}', 'duel', 'k2', 'Alpha', 1, 'loss', 'room00004'), ('${C}', 'duel', 'k3', 'Alpha', 1, 'win', 'room00005');`);
  const board = as('authenticated', C, `select board, place, display_name, score from public.leaderboards();`);
  ok(board === 'duel_rating|1|Bravo|1100\nduel_rating|2|Alpha|1040\nduel_wins|1|Alpha|2\nduel_wins|2|Bravo|1', `the boards read ${JSON.stringify(board)}`);
  ok(as('authenticated', C, `select count(*) from public.leaderboards(1);`) === '2' && as('authenticated', C, `select count(*) from public.leaderboards(0);`) === '2' && as('authenticated', C, `select count(*) from public.leaderboards(-5);`) === '2' && as('authenticated', C, `select count(*) from public.leaderboards(1000);`) === '4', 'the limit is not clamped to 1..50');
  ok(psql(`select pg_get_function_result('public.leaderboards(integer)'::regprocedure);`) === 'TABLE(board text, place integer, display_name text, score integer)', 'leaderboards exposes more than name and number');
  ok(refused('anon', null, `perform * from public.leaderboards()`), 'anon can read the boards');
  ok(as('authenticated', A, `select count(*) from public.leaderboards() where board = 'duel_wins' and display_name = 'Alpha' and score = 2;`) === '1', 'AI rows or another fighter\'s rows changed a duel board');

  // (5) the down file removes exactly what the up file made, and the up file applies again.
  ok(psql(objects) === '3/2', `objects before down: ${psql(objects)}`);
  psql(readFileSync(DOWN, 'utf8'));
  ok(psql(objects) === '0/0', `objects after down: ${psql(objects)}`);
  ok(psql(`select count(*) from public.fight_results;`) === '10' && psql(`select count(*) from public.duel_ratings;`) === '3', 'the down file touched existing rows');
  psql(readFileSync(MIG, 'utf8'));
  ok(psql(objects) === '3/2', 'the up file does not apply again after the down file');
  console.log(`career-service database check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
