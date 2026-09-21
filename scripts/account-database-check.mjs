// Real PostgreSQL role/RLS verification in a disposable, socket-only cluster: a fresh `initdb` cluster on a Unix socket in a
// tempdir, torn down in `finally`. No DATABASE_URL, no SUPABASE_* env var and no service-role key is ever read here — this
// check cannot reach a hosted project even if one were configured, and it never should be made to.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'frankendom-auth-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
// A locale-less shell (hooks, CI, a non-interactive deploy) makes PostgreSQL 17 on macOS abort with
// "postmaster became multithreaded during startup"; a valid LC_ALL keeps the check independent of who runs it.
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env });
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  const bootstrap = `create extension pgcrypto;
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`;
  const checks = `
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    insert into public.fighter_profiles(user_id,display_name,encounter) values(auth.uid(),'Aldren','goblin');
    update public.fighter_profiles set display_name='Aldren II' where user_id=auth.uid() and revision=1;
    do $$begin
      if (select revision from public.fighter_profiles) <> 2 then raise exception 'Revision did not advance'; end if;
      update public.fighter_profiles set display_name='Stale' where user_id=auth.uid() and revision=1;
      if found then raise exception 'Stale save overwrote current'; end if;
      begin update public.fighter_profiles set revision=999; raise exception 'Forged revision allowed'; exception when insufficient_privilege then null; end;
      begin update public.fighter_profiles set user_id='22222222-2222-4222-8222-222222222222'; raise exception 'Owner change allowed'; exception when insufficient_privilege then null; end;
      begin insert into public.fighter_profiles(user_id,display_name) values('22222222-2222-4222-8222-222222222222','Impostor'); raise exception 'Cross-owner insert allowed'; exception when insufficient_privilege then null; end;
      begin delete from public.fighter_profiles; raise exception 'Client delete allowed'; exception when insufficient_privilege then null; end;
      begin update public.fighter_profiles set encounter='admin'; raise exception 'Unknown opponent allowed'; exception when check_violation then null; end;
      begin update public.fighter_profiles set display_name=''; raise exception 'Empty name allowed'; exception when check_violation then null; end;
    end$$;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      if exists(select 1 from public.fighter_profiles) then raise exception 'Other account visible'; end if;
      update public.fighter_profiles set display_name='Stolen';
      if found then raise exception 'Cross-owner update allowed'; end if;
    end$$;
    insert into public.fighter_profiles(user_id,display_name) values(auth.uid(),'Second fighter');
    set role anon;
    do $$begin
      begin perform * from public.fighter_profiles; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
      begin insert into public.fighter_profiles(user_id,display_name) values('11111111-1111-4111-8111-111111111111','Anon'); raise exception 'Anonymous write allowed'; exception when insufficient_privilege then null; end;
    end$$;
    reset role;
    insert into public.admins(user_id) values('11111111-1111-4111-8111-111111111111');
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    do $$begin
      if not exists(select 1 from public.admins where user_id=auth.uid()) then raise exception 'Admin cannot read own roster row'; end if;
      begin insert into public.admins(user_id) values(auth.uid()); raise exception 'Client admin insert allowed'; exception when insufficient_privilege then null; end;
      begin delete from public.admins; raise exception 'Client admin delete allowed'; exception when insufficient_privilege then null; end;
    end$$;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      if exists(select 1 from public.admins) then raise exception 'Other account''s admin row visible'; end if;
      begin insert into public.admins(user_id) values(auth.uid()); raise exception 'Self-grant allowed'; exception when insufficient_privilege then null; end;
    end$$;
    set role anon;
    do $$begin
      begin perform * from public.admins; raise exception 'Anonymous admin read allowed'; exception when insufficient_privilege then null; end;
    end$$;
    reset role;
    do $$begin
      if (select count(*) from public.admins) <> 1 then raise exception 'Admin roster changed by a client'; end if;
      if (select count(*) from public.fighter_profiles) <> 2 then raise exception 'Unexpected rows'; end if;
      if not exists(select 1 from public.fighter_profiles where display_name='Aldren II' and revision=2) then raise exception 'Original save damaged'; end if;
    end$$;`;
  const migrations = readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join('supabase/migrations', n), 'utf8')).join('\n');
  const creatures = `set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    do $$begin
      update public.fighter_profiles set encounter='minotaur' where user_id=auth.uid();
      if not exists(select 1 from public.fighter_profiles where encounter='minotaur') then raise exception 'Minotaur save failed'; end if;
      update public.fighter_profiles set encounter='wraith' where user_id=auth.uid();
      if not exists(select 1 from public.fighter_profiles where encounter='wraith') then raise exception 'Wraith save failed'; end if;
      update public.fighter_profiles set encounter='werewolf' where user_id=auth.uid();
      if not exists(select 1 from public.fighter_profiles where encounter='werewolf') then raise exception 'Werewolf save failed'; end if;
      update public.fighter_profiles set encounter='skeleton' where user_id=auth.uid();
      if not exists(select 1 from public.fighter_profiles where encounter='skeleton') then raise exception 'Skeleton save failed'; end if;
    end$$;
    do $$begin
      update public.fighter_profiles set victory_marks=3 where user_id=auth.uid();
      if (select victory_marks from public.fighter_profiles where user_id=auth.uid()) <> 3 then raise exception 'Marks save failed'; end if;
      begin update public.fighter_profiles set victory_marks=-1 where user_id=auth.uid(); raise exception 'Negative marks allowed'; exception when check_violation then null; end;
      begin update public.fighter_profiles set victory_marks=100001 where user_id=auth.uid(); raise exception 'Absurd marks allowed'; exception when check_violation then null; end;
    end$$;`;
  // Brief 3/4/5 (fight_records, the daily warden, loot). Owner = user 1 throughout; user 2 exercises the cross-owner and
  // wrong-day refusals so a duplicate-key error never masks what's actually under test.
  const dailyLoot = `set time zone 'UTC';   -- the migration's future-day guard keys on the UTC date; current_date below must agree east or west of Greenwich
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    insert into public.fight_records(id,user_id,opponent,record) values('AAAAAAAA',auth.uid(),'veteran','abc123_-ABC');
    do $$begin
      if not exists(select 1 from public.fight_records where id='AAAAAAAA') then raise exception 'Fight record insert failed'; end if;
      begin insert into public.fight_records(id,user_id,opponent,record) values('BBBBBBBB','22222222-2222-4222-8222-222222222222','veteran','abc'); raise exception 'Cross-owner fight record insert allowed'; exception when insufficient_privilege then null; end;
      begin update public.fight_records set opponent='pitborn' where id='AAAAAAAA'; raise exception 'Fight record update allowed'; exception when insufficient_privilege then null; end;
      begin delete from public.fight_records where id='AAAAAAAA'; raise exception 'Fight record delete allowed'; exception when insufficient_privilege then null; end;
      begin perform secret from public.daily_secret; raise exception 'Authenticated read of the daily secret allowed'; exception when insufficient_privilege then null; end;
      if (select seed from public.daily_fight(current_date)) is null then raise exception 'Authenticated cannot fetch today''s daily seed'; end if;
      if exists(select 1 from public.daily_fight(current_date + 1)) then raise exception 'A future daily seed was answered'; end if;
    end$$;
    insert into public.daily_results(day,user_id,number,opponent,weapon,outcome,ticks,location,taken,record)
      values(current_date,auth.uid(),(current_date - date '2026-09-22')::integer,'veteran','longsword','killed',120,'torso',3,'abc123_-ABC');
    do $$begin
      if (select count(*) from public.daily_results where day=current_date) <> 1 then raise exception 'Daily result insert failed'; end if;
      begin insert into public.daily_results(day,user_id,number,opponent,weapon,outcome,ticks,record) values(current_date,auth.uid(),(current_date - date '2026-09-22')::integer,'veteran','longsword','killed',5,'xyz'); raise exception 'A second daily result today was allowed'; exception when unique_violation then null; end;
      begin update public.daily_results set outcome='draw' where day=current_date; raise exception 'Daily result update allowed'; exception when insufficient_privilege then null; end;
      begin delete from public.daily_results where day=current_date; raise exception 'Daily result delete allowed'; exception when insufficient_privilege then null; end;
      update public.fighter_profiles set loot='{"owned":["helm.veteran"],"equipped":{"head":"helm.veteran"}}'::jsonb where user_id=auth.uid();
      if (select loot->'owned' from public.fighter_profiles where user_id=auth.uid()) is null then raise exception 'Loot save failed'; end if;
      begin update public.fighter_profiles set loot='"not an object"'::jsonb where user_id=auth.uid(); raise exception 'Non-object loot allowed'; exception when check_violation then null; end;
      begin update public.fighter_profiles set loot='{"owned":"not-array","equipped":{}}'::jsonb where user_id=auth.uid(); raise exception 'Malformed loot owned array allowed'; exception when check_violation then null; end;
    end$$;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      begin insert into public.daily_results(day,user_id,number,opponent,weapon,outcome,ticks,record) values(current_date,auth.uid(),999,'veteran','longsword','killed',5,'xyz'); raise exception 'A mismatched day/number was allowed'; exception when check_violation then null; end;
      begin insert into public.daily_results(day,user_id,number,opponent,weapon,outcome,ticks,record) values(current_date - 1,auth.uid(),(current_date - 1 - date '2026-09-22')::integer,'veteran','longsword','killed',5,'xyz'); raise exception 'Posting yesterday''s result was allowed'; exception when insufficient_privilege then null; end;
    end$$;
    set role anon;
    do $$begin
      if not exists(select 1 from public.fight_records where id='AAAAAAAA') then raise exception 'Guest cannot read a shared fight record'; end if;
      begin insert into public.fight_records(id,user_id,opponent,record) values('CCCCCCCC','11111111-1111-4111-8111-111111111111','veteran','abc'); raise exception 'Anonymous fight record insert allowed'; exception when insufficient_privilege then null; end;
      begin perform secret from public.daily_secret; raise exception 'Anonymous read of the daily secret allowed'; exception when insufficient_privilege then null; end;
      if (select seed from public.daily_fight(current_date)) is null then raise exception 'Guest cannot fetch today''s daily seed'; end if;
      if not exists(select 1 from public.daily_results where day=current_date) then raise exception 'Guest cannot read the day''s results'; end if;
      begin perform user_id from public.daily_results where day=current_date limit 1; raise exception 'Anonymous read of daily_results.user_id allowed'; exception when insufficient_privilege then null; end;
      begin perform record from public.daily_results where day=current_date limit 1; raise exception 'Anonymous read of daily_results.record allowed'; exception when insufficient_privilege then null; end;
      if not exists(select 1 from public.daily_board where day=current_date) then raise exception 'Guest cannot read the daily board'; end if;
    end$$;
    reset role;`;
  run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], bootstrap + migrations + checks + creatures + dailyLoot);
  console.log('Account database PASS: owner-writable bounded marks column; real PostgreSQL; owner read/write, two-user isolation, anon denial, immutable owner/revision, stale-save rejection, input constraints, no client deletes; fight_records/daily warden/loot RLS (public read minus secret columns, owner-once insert, no update or delete, future-day refusal, day/number integrity, loot shape bounds). No hosted database changed.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
