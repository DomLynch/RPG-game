// The anti-farm storage (migration 202610070001) on real PostgreSQL, in the same disposable socket-only cluster as account-database-check.mjs:
// no DATABASE_URL, no SUPABASE_* and no service-role key is read, so it cannot reach a hosted project. Every migration is applied in order, then:
// a client reads only its own rating and writes nothing; only the verifier role counts a win; the day rule and the per-room rule hold in the
// database itself; ratings move by the gain, never below the floor; a win between accounts that never shared a room is refused.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'frankendom-antifarm-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 120_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const as = (role, user, sql) => psql(`select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};\n${sql}\nreset role;`)
  .split('\n').filter(line => line !== '' && !/^[0-9a-f-]{36}$/.test(line)).join('\n');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444';
const fail = message => { throw Error(message); };
const refused = (role, user, sql, code) => as(role, user, `do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when ${code} then null; end; end$$;`) === '';
const count = (room, w, l, gain = 16, pay = 0, start = 1000, floor = 100) => as('frankendom_verifier', null, `select public.duel_count_win('${room}', '${w}', '${l}', ${gain}, ${pay}, ${start}, ${floor});`);
const rating = user => psql(`select coalesce((select rating::text from public.duel_ratings where user_id = '${user}'), 'none');`);
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
    insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}');`);
  psql(readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join('supabase/migrations', n), 'utf8')).join('\n'));
  // Rooms the fighters registered in (what report_duel_start writes): room00001/2/3 hold A and B, room00004 holds A and C, room00005 only A.
  psql(`insert into public.duel_starts (room, user_id, name, level) values
    ('room00001','${A}','A',1),('room00001','${B}','B',1),('room00002','${A}','A',1),('room00002','${B}','B',1),('room00003','${B}','B',1),('room00003','${A}','A',1),
    ('room00004','${A}','A',1),('room00004','${C}','C',1),('room00005','${A}','A',1);`);

  // (1) clients: no ratings of others, no writes, no calls.
  for (const user of [A, B]) {
    if (!refused('authenticated', user, `insert into public.duel_ratings(user_id, rating) values ('${user}', 9999)`, 'insufficient_privilege')) fail('a client can write a rating');
    if (!refused('authenticated', user, `update public.duel_ratings set rating = 9999`, 'insufficient_privilege')) fail('a client can update a rating');
    if (!refused('authenticated', user, `perform * from public.duel_counted_wins`, 'insufficient_privilege')) fail('a client can read counted wins');
    if (!refused('authenticated', user, `perform public.duel_count_win('room00001', '${A}', '${B}', 16, 0, 1000, 100)`, 'insufficient_privilege')) fail('a client can count a win');
    if (!refused('authenticated', user, `perform public.duel_antifarm_state('${A}', '${B}')`, 'insufficient_privilege')) fail('a client can read the anti-farm state');
  }
  if (!refused('anon', null, `perform * from public.duel_ratings`, 'insufficient_privilege')) fail('anon can read ratings');
  if (!refused('frankendom_verifier', null, `insert into public.duel_ratings(user_id, rating) values ('${A}', 9999)`, 'insufficient_privilege')) fail('the verifier can write a rating directly, not through duel_count_win');

  // (2) a counted win moves both ratings from the start; the state function reports them and today's win; a client then sees ONLY its own rating.
  if (count('room00001', A, B) !== 't') fail('the first win did not count');
  if (rating(A) !== '1016' || rating(B) !== '984') fail(`ratings after one win are ${rating(A)} / ${rating(B)}, not 1016 / 984`);
  const state = JSON.parse(as('frankendom_verifier', null, `select public.duel_antifarm_state('${A}', '${B}');`));
  if (state.winner_rating !== 1016 || state.loser_rating !== 984 || state.wins.length !== 1 || state.wins[0].opponent !== B || !(Number(state.wins[0].at) > 1e12)) fail(`state is ${JSON.stringify(state)}`);
  if (as('authenticated', A, `select rating from public.duel_ratings;`) !== '1016') fail('a client does not see exactly its own rating');
  if (as('authenticated', B, `select count(*) from public.duel_ratings where user_id = '${A}';`) !== '0') fail('a client sees another account\'s rating');

  // (3) the room is counted once (a retried sweep changes nothing); the day rule is the database's too: a rematch in ANOTHER room is refused.
  if (count('room00001', A, B) !== 'f') fail('a room counted twice');
  if (count('room00002', A, B) !== 'f') fail('a second win over the same opponent the same day counted');
  if (rating(A) !== '1016' || rating(B) !== '984') fail('a refused win moved a rating');
  // The same pair the other way round is a different (winner, opponent): it counts; B beat A, so both ratings move back toward the start.
  if (count('room00003', B, A) !== 't' || rating(B) !== '1000' || rating(A) !== '1000') fail(`B beating A did not move ratings back: ${rating(A)} / ${rating(B)}`);
  // Yesterday does not block today: age the first counted win a day and the same pair counts again.
  psql(`update public.duel_counted_wins set day = day - 1, created_at = created_at - interval '1 day' where room = 'room00001';`);
  if (count('room00002', A, B) !== 't') fail('yesterday\'s win blocked today\'s');

  // (4) the floor, a new account's start, and the arguments: no rating below the floor; nothing for accounts that never shared a room.
  if (count('room00004', A, C, 16, 0, 1000, 100) !== 't' || rating(C) !== '984') fail('a new loser did not start at start - gain');
  psql(`update public.duel_ratings set rating = 105 where user_id = '${C}';`);
  psql(`insert into public.duel_starts (room, user_id, name, level) values ('room00006','${B}','B',1),('room00006','${C}','C',1);`);
  if (count('room00006', B, C, 30, 0, 1000, 100) !== 't' || rating(C) !== '100') fail(`the loser fell below the floor: ${rating(C)}`);
  if (!refused('frankendom_verifier', null, `perform public.duel_count_win('room00005', '${A}', '${C}', 16, 0, 1000, 100)`, 'invalid_parameter_value')) fail('a win between accounts that never shared the room was counted');
  if (!refused('frankendom_verifier', null, `perform public.duel_count_win('room00001', '${A}', '${A}', 16, 0, 1000, 100)`, 'invalid_parameter_value')) fail('an account beat itself');
  if (!refused('frankendom_verifier', null, `perform public.duel_count_win('room00001', '${A}', '${B}', 5000, 0, 1000, 100)`, 'invalid_parameter_value')) fail('an absurd gain was accepted');
  // The ceiling: a rating never passes the column's 10000, so a winner at 9999 ends at 10000 and the call does not fail on the check constraint.
  psql(`insert into public.duel_starts (room, user_id, name, level) values ('room00007','${A}','A',1),('room00007','${D}','D',1); update public.duel_ratings set rating = 9999 where user_id = '${A}';`);
  if (count('room00007', A, D) !== 't' || rating(A) !== '10000') fail(`a winner at 9999 did not clamp to 10000: ${rating(A)}`);
  // (5) deleting an account deletes its rating and counted wins (on delete cascade).
  psql(`delete from auth.users where id = '${C}';`);
  if (psql(`select count(*) from public.duel_ratings where user_id = '${C}' union all select count(*) from public.duel_counted_wins where opponent = '${C}' or winner = '${C}';`).split('\n').some(n => n !== '0')) fail('an account\'s anti-farm rows survived its deletion');
  console.log('Duel anti-farm database PASS: clients read only their own rating and write nothing; only the verifier role counts a win; one count per room and per (winner, opponent, UTC day) in the database; ratings move by the gain from the start, never below the floor or above 10000; a win between accounts that never shared a room is refused; rows cascade with the account.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
