// The season archive (migration 202610080011) on real PostgreSQL, in the same disposable socket-only cluster as duel-antifarm-database-check.mjs:
// no DATABASE_URL, no SUPABASE_* and no service-role key is read, so it cannot reach a hosted project. Every migration is applied in order, then:
// closing a season copies every live rating into the archive, verifies it and only then empties the live ladder; a season name is used once; an empty
// ladder closes cleanly; clients read only their own archived rows, write nothing and cannot call the close; the counted-wins log is untouched; the
// down-script refuses while a season is archived and removes exactly the new objects once it is empty.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
const root = mkdtempSync(join(tmpdir(), 'frankendom-season-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 120_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const as = (role, user, sql) => psql(`select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};\n${sql}\nreset role;`)
  .split('\n').filter(line => line !== '' && !/^[0-9a-f-]{36}$/.test(line)).join('\n');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
const fail = message => { throw Error(message); };
const refused = (role, user, sql, code) => as(role, user, `do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when ${code} then null; end; end$$;`) === '';
const refusedOwner = (sql, code) => psql(`do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when ${code} then null; end; end$$;`) === '';   // as the cluster owner (the service role's seat)
const close = season => JSON.parse(psql(`select public.duel_season_close('${season}')::text;`));
const live = () => psql(`select count(*) || '/' || coalesce(sum(rating), 0) from public.duel_ratings;`);
const archived = season => psql(`select count(*) || '/' || coalesce(sum(rating), 0) from public.duel_season_ratings where season = '${season}';`);
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
  psql(readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join('supabase/migrations', n), 'utf8')).join('\n'));
  psql(`insert into public.duel_ratings (user_id, rating, updated_at) values ('${A}', 1016, '2026-10-01'), ('${B}', 984, '2026-10-02'), ('${C}', 1200, '2026-10-03');
    insert into public.duel_counted_wins (room, winner, opponent, day, gain) values ('room00001', '${A}', '${B}', '2026-10-01', 16);`);

  // (1) clients cannot close a season, nor write the archive.
  for (const role of ['anon', 'authenticated', 'frankendom_verifier', 'frankendom_origins']) {
    if (!refused(role, A, `perform public.duel_season_close('beta')`, 'insufficient_privilege')) fail(`${role} could close a season`);
  }
  if (!refused('authenticated', A, `insert into public.duel_season_ratings (season, user_id, rating, updated_at) values ('beta', '${A}', 9999, now())`, 'insufficient_privilege')) fail('a client wrote the archive');
  if (!refused('anon', null, `perform * from public.duel_season_ratings`, 'insufficient_privilege')) fail('anon can read the archive');

  // (2) close: every row archived and verified, then the live ladder is empty; the counted-wins log is untouched.
  const before = live();
  if (before !== '3/3200') fail(`setup: live ladder ${before}`);
  const r = close('beta');
  if (r.season !== 'beta' || r.archived !== 3 || r.rating_sum !== 3200 || r.live_after !== 0) fail(`close returned ${JSON.stringify(r)}`);
  if (archived('beta') !== before || live() !== '0/0') fail(`after close: archive ${archived('beta')}, live ${live()}`);
  if (psql(`select updated_at::date from public.duel_season_ratings where season = 'beta' and user_id = '${C}'`) !== '2026-10-03') fail('the live row\'s updated_at was not kept');
  if (psql('select count(*) from public.duel_counted_wins') !== '1') fail('the counted-wins log changed');

  // (3) a client sees only its own archived row.
  if (as('authenticated', A, `select rating from public.duel_season_ratings;`) !== '1016') fail('a client does not see exactly its own archived rating');
  if (as('authenticated', B, `select count(*) from public.duel_season_ratings where user_id = '${A}';`) !== '0') fail('a client sees another player\'s archived rating');

  // (4) a season name is used once (nothing changes on the second call); a bad name is refused; a new season over an empty ladder closes cleanly.
  psql(`insert into public.duel_ratings (user_id, rating) values ('${A}', 1100);`);
  if (!refusedOwner(`perform public.duel_season_close('beta')`, 'unique_violation')) fail('a season name was used twice');
  if (live() !== '1/1100' || archived('beta') !== '3/3200') fail('a refused close changed something');
  for (const bad of ['Beta', '', '-x', 'a'.repeat(33), 'x y']) if (!refusedOwner(`perform public.duel_season_close('${bad}')`, 'invalid_parameter_value')) fail(`season name "${bad}" accepted`);
  if (close('s1').archived !== 1 || live() !== '0/0') fail('season s1 did not archive the one new row');
  const empty = close('s2');
  if (empty.archived !== 0 || empty.live_after !== 0 || archived('s2') !== '0/0') fail(`an empty ladder did not close cleanly: ${JSON.stringify(empty)}`);

  // (5) the down-script refuses while a season is archived, and removes exactly the new objects once the archive is empty.
  const down = readFileSync(join('supabase', 'down', '202610080011_duel_season_archive_down.sql'), 'utf8');
  let downRefused = false;
  try { psql(down); } catch { downRefused = true; }
  if (!downRefused || psql(`select to_regclass('public.duel_season_ratings') is not null`) !== 't') fail('the down-script dropped an archive that holds seasons');
  psql(`delete from public.duel_season_ratings; ${down}`);
  if (psql(`select (to_regclass('public.duel_season_ratings') is null)::text || '/' || (to_regprocedure('public.duel_season_close(text)') is null)::text || '/' || (to_regclass('public.duel_ratings') is not null)::text`) !== 'true/true/true') fail('down did not remove exactly the new objects');
  console.log('Duel season archive database PASS: a close archives every live rating, verifies it and only then resets the ladder; one close per season name; clients read only their own archived rows and cannot close; the counted-wins log is untouched; down refuses while seasons are archived.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
