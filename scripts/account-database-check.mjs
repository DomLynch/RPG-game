// Real PostgreSQL role/RLS verification in a disposable, socket-only cluster: a fresh `initdb` cluster on a Unix socket in a
// tempdir, torn down in `finally`. No DATABASE_URL, no SUPABASE_* env var and no service-role key is ever read here — this
// check cannot reach a hosted project even if one were configured, and it never should be made to.
import { execFileSync, spawn } from 'node:child_process';
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
  const bootstrap = `create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant truncate, trigger, references on tables to anon, authenticated;   -- hosted Supabase's residue on tables created without a revoke-all (verified live 2026-09-22): the 0010 hygiene revoke must have something to revoke here too
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
  // fight_records (202609210002, narrowed by 202609220006): a guest holding a link reads exactly (id, opponent, record) — not the
  // sharer's user_id or created_at — and cannot insert, update or delete.
  const fightRecords = `set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    insert into public.fight_records(id,user_id,opponent,record) values('AAAAAAAA',auth.uid(),'veteran','abc123_-ABC');
    do $$begin
      -- fight_records_recent (the definer function backing the rate-limit policy) must still count correctly and still cap at
      -- 30/hour after the select grant was narrowed: 29 more bring the owner to 30 (must all succeed), the 31st must be refused.
      for i in 1..29 loop
        insert into public.fight_records(id,user_id,opponent,record) values('RATE' || lpad(i::text, 4, '0'), auth.uid(), 'veteran', 'abc');
      end loop;
      if (select count(*) from public.fight_records) <> 30 then raise exception 'Rate-limited insert count is not 30 after 30 allowed inserts'; end if;
      begin insert into public.fight_records(id,user_id,opponent,record) values('RATE0030',auth.uid(),'veteran','abc'); raise exception 'A 31st fight record within the hour was allowed'; exception when insufficient_privilege then null; end;
    end$$;
    set role anon;
    do $$begin
      if not exists(select 1 from public.fight_records where id='AAAAAAAA') then raise exception 'Guest cannot find a shared fight record by id'; end if;
      if (select record from public.fight_records where id='AAAAAAAA') is null then raise exception 'Guest cannot read the record column'; end if;
      begin perform user_id from public.fight_records where id='AAAAAAAA'; raise exception 'Anonymous read of fight_records.user_id allowed'; exception when insufficient_privilege then null; end;
      begin perform created_at from public.fight_records where id='AAAAAAAA'; raise exception 'Anonymous read of fight_records.created_at allowed'; exception when insufficient_privilege then null; end;
      begin insert into public.fight_records(id,user_id,opponent,record) values('BBBBBBBB','11111111-1111-4111-8111-111111111111','veteran','abc'); raise exception 'Anonymous fight record insert allowed'; exception when insufficient_privilege then null; end;
      begin update public.fight_records set opponent='pitborn' where id='AAAAAAAA'; raise exception 'Anonymous fight record update allowed'; exception when insufficient_privilege then null; end;
      begin delete from public.fight_records where id='AAAAAAAA'; raise exception 'Anonymous fight record delete allowed'; exception when insufficient_privilege then null; end;
    end$$;
    reset role;`;
  // wrong-day refusals so a duplicate-key error never masks what's actually under test.
  const dailyLoot = `set time zone 'UTC';   -- the migration's future-day guard keys on the UTC date; current_date below must agree east or west of Greenwich
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    do $$begin
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
      -- 202609260001: a well-played fighter's loot (over 0004's old 4 KB) saves; past the 64 KB backstop it is refused. md5 hex does not compress.
      update public.fighter_profiles set loot=jsonb_build_object('owned','[]'::jsonb,'equipped','{}'::jsonb,'pad',(select string_agg(md5(i::text),'') from generate_series(1,200) i)) where user_id=auth.uid();
      if (select pg_column_size(loot) from public.fighter_profiles where user_id=auth.uid()) <= 4096 then raise exception 'Loot over 4 KB was not saved'; end if;
      begin update public.fighter_profiles set loot=jsonb_build_object('owned','[]'::jsonb,'equipped','{}'::jsonb,'pad',(select string_agg(md5(i::text),'') from generate_series(1,2500) i)) where user_id=auth.uid(); raise exception 'Loot over 64 KB allowed'; exception when check_violation then null; end;
    end$$;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      begin insert into public.daily_results(day,user_id,number,opponent,weapon,outcome,ticks,record) values(current_date,auth.uid(),999,'veteran','longsword','killed',5,'xyz'); raise exception 'A mismatched day/number was allowed'; exception when check_violation then null; end;
      begin insert into public.daily_results(day,user_id,number,opponent,weapon,outcome,ticks,record) values(current_date - 1,auth.uid(),(current_date - 1 - date '2026-09-22')::integer,'veteran','longsword','killed',5,'xyz'); raise exception 'Posting yesterday''s result was allowed'; exception when insufficient_privilege then null; end;
    end$$;
    set role anon;
    do $$begin
      begin perform secret from public.daily_secret; raise exception 'Anonymous read of the daily secret allowed'; exception when insufficient_privilege then null; end;
      if (select seed from public.daily_fight(current_date)) is null then raise exception 'Guest cannot fetch today''s daily seed'; end if;
      if not exists(select 1 from public.daily_results where day=current_date) then raise exception 'Guest cannot read the day''s results'; end if;
      begin perform user_id from public.daily_results where day=current_date limit 1; raise exception 'Anonymous read of daily_results.user_id allowed'; exception when insufficient_privilege then null; end;
      begin perform record from public.daily_results where day=current_date limit 1; raise exception 'Anonymous read of daily_results.record allowed'; exception when insufficient_privilege then null; end;
      if not exists(select 1 from public.daily_board where day=current_date) then raise exception 'Guest cannot read the daily board'; end if;
    end$$;
    reset role;`;
  // daily_board_summary (202609220007): the board over EVERY row of the day, not the first 200; verified rows lead pending ones; the
  // location split counts verified deaths only; another day's rows never leak in. Rows are seeded as the superuser (the insert policy
  // and the verifier's flip are proven above; this proves the summary), then read as the guest the client is.
  const dailySummary = `set time zone 'UTC';
    reset role;
    insert into auth.users select ('33333333-3333-4333-8333-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 204) i;
    -- 201 verified kills posted in order; the FASTEST (ticks 100) is the 201st, exactly the row a 200-row page ordered by created_at drops.
    insert into public.daily_results(day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record, verified, created_at)
      select current_date, ('33333333-3333-4333-8333-' || lpad(i::text, 12, '0'))::uuid, (current_date - date '2026-09-22')::integer, 'veteran', 'longsword', 'killed',
             case when i = 201 then 100 else 1000 + i end, 'torso', 5, 'abc', true, now() + (i || ' seconds')::interval from generate_series(1, 201) i;
    -- a PENDING kill faster than every verified one (ticks 1, taken 0): it must not lead either kill line while a verified row exists.
    insert into public.daily_results(day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record, verified, created_at)
      values (current_date, '33333333-3333-4333-8333-000000000202', (current_date - date '2026-09-22')::integer, 'veteran', 'longsword', 'killed', 1, 'torso', 0, 'abc', false, now());
    -- deaths: two verified on the head, one pending on the legs (the pending one must not count in the split); another day's verified kill (ticks 1) must not leak in.
    insert into public.daily_results(day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record, verified, created_at) values
      (current_date, '33333333-3333-4333-8333-000000000203', (current_date - date '2026-09-22')::integer, 'veteran', 'longsword', 'died', 2000, 'head', 9, 'abc', true, now()),
      (current_date, '33333333-3333-4333-8333-000000000204', (current_date - date '2026-09-22')::integer, 'veteran', 'longsword', 'died', 50, 'head', 1, 'abc', true, now()),
      (current_date - 1, '33333333-3333-4333-8333-000000000001', (current_date - 1 - date '2026-09-22')::integer, 'veteran', 'longsword', 'killed', 1, 'torso', 0, 'abc', true, now() - interval '1 day');
    update public.daily_results set outcome = 'died', location = 'legs', verified = false where day = current_date and user_id = '11111111-1111-4111-8111-111111111111';   -- the owner's row from above becomes a PENDING death on the legs
    set role anon;
    do $$declare s jsonb; begin
      s := public.daily_board_summary(current_date);
      if (s->'fastest_kill'->>'ticks')::integer <> 100 then raise exception 'Fastest kill is not the 201st row (ticks %)', s->'fastest_kill'->>'ticks'; end if;
      if not (s->'fastest_kill'->>'verified')::boolean then raise exception 'A pending kill led the fastest-kill line'; end if;
      if (s->'cleanest_kill'->>'taken')::integer <> 5 or not (s->'cleanest_kill'->>'verified')::boolean then raise exception 'A pending kill led the cleanest-kill line'; end if;
      if (s->'longest_survived'->>'ticks')::integer <> 2000 or (s->'fastest_death'->>'ticks')::integer <> 50 then raise exception 'Death lines wrong: % / %', s->'longest_survived'->>'ticks', s->'fastest_death'->>'ticks'; end if;
      if s->'where' <> '{"head": 2}'::jsonb then raise exception 'Location split counted a pending death or another day: %', s->'where'; end if;
      if (s->>'pending')::integer <> 2 then raise exception 'Pending count is not 2: %', s->>'pending'; end if;
      if s->'fastest_kill' ? 'record' or s->'fastest_kill' ? 'user_id' then raise exception 'The summary leaks record or user_id'; end if;
      if jsonb_typeof((public.daily_board_summary(current_date + 1))->'fastest_kill') <> 'null' or ((public.daily_board_summary(current_date + 1))->>'pending')::integer <> 0 then raise exception 'Tomorrow has a board'; end if;
    end$$;
    reset role;`;
  // mint_share (202609220009): short sequential base-36 ids for guests and fighters alike; the old 8-char rows keep resolving; the caps
  // trip. User 1 already holds 30 rows this hour (fightRecords above), so the signed-in mints are user 2's. Runs last: it fills the
  // sequence and the guest cap.
  const shortShare = `select set_config('request.jwt.claim.sub','',false);   -- a real guest carries no sub claim; the stub's auth.uid() must read null, not the last signed-in user
    set role anon;
    do $$declare a text; b text; begin
      a := public.mint_share('abc123_-ABC', 'veteran');
      if a <> '1' then raise exception 'First minted id is not 1: %', a; end if;
      b := public.mint_share('abc', 'goblin');
      if b <> '2' then raise exception 'Second minted id is not 2: %', b; end if;
      if (select opponent from public.fight_records where id = b) <> 'goblin' then raise exception 'Guest mint not stored'; end if;
      if (select record from public.fight_records where id = 'AAAAAAAA') is null then raise exception 'Old 8-char id stopped resolving'; end if;
      begin perform public.mint_share('abc', repeat('x', 33)); raise exception 'Overlong opponent minted'; exception when check_violation then null; end;
      begin perform public.mint_share('not base64url!', 'veteran'); raise exception 'Bad record alphabet minted'; exception when check_violation then null; end;
      begin perform public.fight_records_recent(); raise exception 'Guest can call fight_records_recent'; exception when insufficient_privilege then null; end;
      begin perform nextval('public.share_ids'); raise exception 'Guest can touch the sequence'; exception when insufficient_privilege then null; end;
    end$$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$declare c text; last text; begin
      c := public.mint_share('abc', 'veteran');
      if c <> '3' then raise exception 'Signed-in mint did not continue the sequence: %', c; end if;
      for i in 1..29 loop last := public.mint_share('abc', 'veteran'); end loop;   -- 30 this hour for user 2
      if last <> 'w' then raise exception 'Ids are not monotonic base-36 of the sequence: % (expected w = 32)', last; end if;
      begin perform public.mint_share('abc', 'veteran'); raise exception 'A 31st signed-in share within the hour was minted' using errcode = 'assert_failure'; exception when raise_exception then null; end;
    end$$;
    reset role;
    do $$begin
      if (select user_id from public.fight_records where id = '3') <> '22222222-2222-4222-8222-222222222222' then raise exception 'Signed-in mint has the wrong owner'; end if;
      if (select user_id from public.fight_records where id = '1') is not null then raise exception 'Guest mint has an owner'; end if;
    end$$;
    select set_config('request.jwt.claim.sub','',false);
    update public.share_limits set guest_per_minute = 60;   -- the global backstop, low enough to trip here (its default is 600 behind the per-caller cap)
    set role anon;
    do $$begin
      for i in 1..58 loop perform public.mint_share('abc', 'veteran'); end loop;   -- 60 guest shares this minute, with the two above
      begin perform public.mint_share('abc', 'veteran'); raise exception 'A 61st guest share within the minute was minted' using errcode = 'assert_failure'; exception when raise_exception then null; end;
      if not exists(select 1 from public.fight_records where id = 'AAAAAAAA') then raise exception 'Old 8-char id stopped resolving after minting'; end if;
    end$$;
    reset role;`;
  // Guest share hygiene (202609220010): the limits row is unreadable by clients; the per-caller bucket (salted hash of the gateway's
  // client address, as PostgREST hands it in request.headers) caps one address without touching another; an unparseable header is
  // "no key", never an error; the ceiling trips; pruning removes exactly the guest rows older than guest_days and never a signed-in
  // or old-format row; clients cannot truncate. Runs after shortShare: 60 unkeyed guest rows + 30 of user 2's exist.
  const guestHygiene = `select set_config('request.jwt.claim.sub','',false);
    set role anon;
    do $$begin
      begin perform * from public.share_limits; raise exception 'Guest can read share_limits'; exception when insufficient_privilege then null; end;
      begin perform public.prune_guest_shares(); raise exception 'Guest can prune'; exception when insufficient_privilege then null; end;
      begin truncate public.fight_records; raise exception 'Guest can truncate fight_records' using errcode = 'assert_failure'; exception when insufficient_privilege then null; end;
      begin perform guest_key from public.fight_records where id = '1'; raise exception 'Guest can read guest_key'; exception when insufficient_privilege then null; end;
    end$$;
    reset role;
    update public.share_limits set guest_per_minute = 100000;   -- backstop out of the way: the per-caller cap is under test
    select set_config('request.headers', '{"x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "check"}', false);   -- what PostgREST hands the function
    set role anon;
    do $$begin
      for i in 1..10 loop perform public.mint_share('abc', 'veteran'); end loop;
      begin perform public.mint_share('abc', 'veteran'); raise exception 'An 11th share from one address within the minute was minted' using errcode = 'assert_failure'; exception when raise_exception then null; end;
    end$$;
    select set_config('request.headers', '{"x-forwarded-for": "198.51.100.7"}', false);   -- a different address is not capped by the first
    do $$begin perform public.mint_share('abc', 'veteran'); end$$;
    select set_config('request.headers', 'not json', false);   -- an unparseable header is "no key", never an error
    do $$begin perform public.mint_share('abc', 'veteran'); end$$;
    select set_config('request.headers', '', false);
    reset role;
    do $$begin
      if (select count(*) from public.fight_records where guest_key is not null) <> 11 then raise exception 'Keyed guest rows are not 11: %', (select count(*) from public.fight_records where guest_key is not null); end if;
      if exists(select 1 from public.fight_records where guest_key !~ '^[0-9a-f]{64}$' or guest_key like '%203.0.113.9%') then raise exception 'guest_key is not a salted hash'; end if;
      if (select count(distinct guest_key) from public.fight_records where guest_key is not null) <> 2 then raise exception 'Two addresses should give two keys'; end if;
    end$$;
    update public.share_limits set guest_rows = 72;   -- 72 guest rows exist now (60 + 10 + 1 + 1): the ceiling is met, the minute caps are not
    set role anon;
    do $$begin
      begin perform public.mint_share('abc', 'veteran'); raise exception 'A guest share past the row ceiling was minted' using errcode = 'assert_failure'; exception when raise_exception then null; end;
    end$$;
    reset role;
    update public.share_limits set guest_rows = 50000, guest_days = 7;
    update public.fight_records set created_at = now() - interval '8 days' where user_id is null and id in ('1', '2');   -- two old guest rows
    update public.fight_records set created_at = now() - interval '8 days' where id = '3';                              -- one old SIGNED-IN row
    do $$declare n integer; begin
      n := public.prune_guest_shares();
      if n <> 2 then raise exception 'Pruned % rows, expected the 2 old guest rows', n; end if;
      if exists(select 1 from public.fight_records where id in ('1', '2')) then raise exception 'Old guest rows survived pruning'; end if;
      if not exists(select 1 from public.fight_records where id = '3') then raise exception 'Pruning removed a signed-in row'; end if;
      if not exists(select 1 from public.fight_records where id = 'AAAAAAAA') then raise exception 'Pruning removed an old-format row'; end if;
      if (select count(*) from public.fight_records where user_id is null) <> 70 then raise exception 'Guest row count after pruning is not 70'; end if;
    end$$;
    -- The daily prune is a pg_cron job. The extension is available on hosted Supabase, not on this local cluster: assert the row where
    -- pg_cron exists (CI images with it, hosted), and say so where it does not — the job row is then verified live after apply.
    do $$begin
      if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        if not exists (select 1 from cron.job where jobname = 'frankendom_guest_share_retention' and schedule = '17 4 * * *' and command = 'select public.prune_guest_shares()' and active) then
          raise exception 'The guest-share retention cron job is missing or wrong';
        end if;
      else
        raise notice 'pg_cron is not available on this cluster: the retention job row is verified live after apply, not here';
      end if;
    end$$;
    set role anon;
    do $$declare id text; begin
      id := public.mint_share('abc', 'veteran');   -- below the ceiling again after pruning
      if id is null then raise exception 'Guest cannot mint after pruning'; end if;
    end$$;
    reset role;`;
  // Anonymous perf beacons (202609280001): insert-only for the client roles, the listed columns only, every column range-checked, no
  // identity or address column anywhere, global per-minute and per-day caps per row, 90-day prune, the device spread view service-only.
  const beacon = (over = {}) => {
    const row = { revision: "'026d07e4'", fps_p50: 58, fps_p5: 41, frames: 3400, fight_s: 58.5, dropped: 120, first_fight_s: 6.2, render_ratio: 1.5, lowered_from: 'null', dpr_override: 'null', tris: 180000, draws: 140, gfx_tier: "'phone'", look_on: 'false', ua: "'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'", screen: "'393x852@3'", cores: 6, memory_gb: 'null', raf_ms: 16.7, raf_capped: 'false', ...over };
    return `insert into public.perf_beacons (${Object.keys(row).join(', ')}) values (${Object.values(row).join(', ')})`;
  };
  const refusedAs = (code, sql, why) => `begin ${sql}; raise exception '${why}' using errcode = 'assert_failure'; exception when ${code} then null; end;`;
  const perfBeacons = `select set_config('request.jwt.claim.sub','',false);
    do $$begin
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perf_beacons'
        and (data_type in ('inet', 'cidr', 'uuid', 'jsonb', 'json') or column_name ~ '(user|ip|addr|session|email|record)')) then
        raise exception 'perf_beacons holds an identity, address or free-form column';
      end if;
      if (select array_agg(tgname::text) from pg_trigger where tgrelid = 'public.perf_beacons'::regclass and not tgisinternal) <> array['perf_beacons_rate'] then
        raise exception 'perf_beacons has a trigger other than its rate cap';
      end if;
      if exists (select 1 from pg_attribute where attrelid = 'public.perf_beacons'::regclass and attnum > 0 and not attisdropped and atthasdef
        and attname not in ('created_at')) and exists (select 1 from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
        where d.adrelid = 'public.perf_beacons'::regclass and pg_get_expr(d.adbin, d.adrelid) ~ '(auth\\.|inet_|request\\.|current_setting)') then
        raise exception 'a perf_beacons default reads the request';
      end if;
    end$$;
    set role anon;
    ${beacon()};
    ${beacon({ look_on: 'true', look_swap_s: 1.2, swapped_before_first_exchange: 'true', look_due: 'true' })};
    ${beacon({ look_due: 'true' })};
    ${beacon({ gfx_tier: "'full'", look_on: 'true', lowered_from: 2, first_fight_s: 'null', cores: 'null', memory_gb: 8, dpr_override: 1, raf_ms: 33.3, raf_capped: 'true', screen: "'1440x900@2'", ua: "'Mozilla/5.0 (Linux; Android 14)'" })};
    do $$begin
      ${refusedAs('insufficient_privilege', 'perform * from public.perf_beacons', 'A guest can read perf_beacons')}
      ${refusedAs('check_violation', beacon({ look_swap_s: 1.2, look_due: 'true' }), 'A swap time without its before-the-first-exchange flag was accepted')}
      ${refusedAs('check_violation', beacon({ look_swap_s: 1.2, swapped_before_first_exchange: 'true', look_due: 'false' }), 'A swap time on a fight with no look due was accepted')}
      ${refusedAs('insufficient_privilege', 'update public.perf_beacons set fps_p50 = 1', 'A guest can update perf_beacons')}
      ${refusedAs('insufficient_privilege', 'delete from public.perf_beacons', 'A guest can delete perf_beacons')}
      ${refusedAs('insufficient_privilege', 'truncate public.perf_beacons', 'A guest can truncate perf_beacons')}
      ${refusedAs('insufficient_privilege', "insert into public.perf_beacons (created_at, revision, fps_p50, fps_p5, frames, fight_s, dropped, render_ratio, tris, draws, gfx_tier, look_on, ua, screen, raf_capped) values ('2000-01-01', '026d07e4', 1, 1, 1, 1, 0, 1, 0, 0, 'phone', false, 'x', '1x1@1', false)", 'A guest can set created_at')}
      ${refusedAs('insufficient_privilege', 'perform * from public.perf_device_spread', 'A guest can read the device spread')}
      ${refusedAs('insufficient_privilege', 'perform public.prune_perf_beacons()', 'A guest can prune perf_beacons')}
      ${refusedAs('insufficient_privilege', 'perform public.perf_beacons_rate()', 'A guest can call the rate function')}
      ${refusedAs('not_null_violation', beacon({ raf_capped: 'null' }), 'A beacon with no raf_capped was stored')}
      ${[{ fps_p5: 59 }, { fps_p50: 241, fps_p5: 1 }, { dropped: 3401 }, { frames: 0, dropped: 0 }, { gfx_tier: "'ultra'" }, { ua: "repeat('a', 301)" }, { ua: "'a' || chr(10)" },
        { screen: "'393x852'" }, { screen: "'393x852@3; drop'" }, { revision: "'main'" }, { render_ratio: "'NaN'" }, { render_ratio: "'Infinity'" }, { lowered_from: 1.5 },
        { first_fight_s: 601 }, { tris: -1 }, { cores: 0 }, { memory_gb: "'NaN'" }, { fight_s: 3601 }, { raf_ms: 4 }, { raf_ms: 1001 }, { raf_ms: "'NaN'" }]
        .map(over => refusedAs('check_violation', beacon(over), `A beacon with ${JSON.stringify(over).replace(/'/g, '')} was stored`)).join('\n      ')}
    end$$;
    reset role;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    set role authenticated;
    ${beacon({ gfx_tier: "'full'" })};
    do $$begin ${refusedAs('insufficient_privilege', 'perform * from public.perf_beacons', 'A fighter can read perf_beacons')} end$$;
    reset role;
    select set_config('request.jwt.claim.sub','',false);
    do $$begin
      if (select count(*) from public.perf_beacons) <> 5 then raise exception 'Expected the 5 valid beacons, found %', (select count(*) from public.perf_beacons); end if;
      if (select count(*) from public.perf_device_spread where device = 'iPhone' and gfx_tier = 'phone' and fights = 3) <> 1 then raise exception 'The device spread did not group the 3 iPhone beacons'; end if;
      if (select lowered_share from public.perf_device_spread where device = 'Android') <> 1 then raise exception 'The device spread did not count the auto-drop'; end if;
      if (select raf_capped_share from public.perf_device_spread where device = 'Android') <> 1 or (select raf_capped_share from public.perf_device_spread where device = 'iPhone' and gfx_tier = 'phone') <> 0 then raise exception 'The device spread did not count the 30 Hz cap'; end if;
    end$$;
    -- The minute cap: 120, per row, so one bulk insert cannot pass it.
    set role anon;
    do $$begin
      for i in 1..115 loop ${beacon()}; end loop;   -- 120 this minute
      ${refusedAs('insufficient_privilege', beacon(), 'A 121st beacon within the minute was stored')}
    end$$;
    reset role;
    update public.perf_beacons set created_at = now() - interval '2 minutes';   -- the minute window clear; all 120 still today
    set role anon;
    do $$begin
      ${refusedAs('insufficient_privilege', beacon().replace(/values \((.*)\)$/, "select $1 from generate_series(1, 121)"), 'A bulk insert of 121 passed the minute cap')}
    end$$;
    reset role;
    do $$begin if (select count(*) from public.perf_beacons) <> 120 then raise exception 'A refused bulk insert left rows behind'; end if; end$$;
    -- The day cap: 20000.
    alter table public.perf_beacons disable trigger perf_beacons_rate;
    insert into public.perf_beacons (revision, fps_p50, fps_p5, frames, fight_s, dropped, render_ratio, tris, draws, gfx_tier, look_on, ua, screen, raf_capped)
      select '026d07e4', 60, 50, 100, 2, 0, 1, 0, 0, 'phone', false, 'x', '1x1@1', false from generate_series(1, 19880);
    update public.perf_beacons set created_at = now() - interval '1 hour' where created_at > now() - interval '1 minute';
    alter table public.perf_beacons enable trigger perf_beacons_rate;
    set role anon;
    do $$begin ${refusedAs('insufficient_privilege', beacon(), 'A 20001st beacon within the day was stored')} end$$;
    reset role;
    -- Retention: 90 days.
    update public.perf_beacons set created_at = now() - interval '91 days' where id in (select id from public.perf_beacons order by id limit 5);
    do $$declare n integer; begin
      n := public.prune_perf_beacons();
      if n <> 5 then raise exception 'Pruned % beacons, expected the 5 old ones', n; end if;
      if (select count(*) from public.perf_beacons) <> 19995 then raise exception 'Pruning removed a recent beacon'; end if;
    end$$;
    do $$begin
      if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        if not exists (select 1 from cron.job where jobname = 'frankendom_perf_beacon_retention' and schedule = '23 4 * * *' and command = 'select public.prune_perf_beacons()' and active) then
          raise exception 'The perf beacon retention cron job is missing or wrong';
        end if;
      else
        raise notice 'pg_cron is not available on this cluster: the perf beacon retention job row is verified live after apply, not here';
      end if;
    end$$;`;
  // Live PvP connection metrics (202609300001): insert-only for the client roles, listed columns only, range-checked, no identity column,
  // its own caps and prune (Duel lane; Lead 2026-09-29: not perf_beacons).
  const duelRow = (over = {}) => {
    const row = { revision: "'026d07e4'", room: "'k3v9q2x7m1'", side: 0, path: "'direct'", candidate: "'srflx'", frames: 3600, rollbacks_per_min: 150, depth_p95: 2, max_depth: 8,
      stalls_per_min: 0, delay: 2, max_delay: 3, rtt_p50_ms: 42, rtt_p95_ms: 70, desyncs: 0, corrections_per_min: 0.5, ua: "'Mozilla/5.0 (iPhone)'", ...over };
    return `insert into public.duel_metrics (${Object.keys(row).join(', ')}) values (${Object.values(row).join(', ')})`;
  };
  const duelMetrics = `select set_config('request.jwt.claim.sub','',false);
    do $$begin
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'duel_metrics'
        and (data_type in ('inet', 'cidr', 'uuid', 'jsonb', 'json') or column_name ~ '(user|ip|addr|session|email|record)')) then
        raise exception 'duel_metrics holds an identity, address or free-form column';
      end if;
      if (select array_agg(tgname::text) from pg_trigger where tgrelid = 'public.duel_metrics'::regclass and not tgisinternal) <> array['duel_metrics_rate'] then
        raise exception 'duel_metrics has a trigger other than its rate cap';
      end if;
    end$$;
    set role anon;
    ${duelRow({ result: "'finished'", reconnects: 0 })};
    ${duelRow({ side: 1, path: "'relay'", candidate: 'null', rtt_p50_ms: 'null', rtt_p95_ms: 'null', corrections_per_min: 'null', result: "'forfeit-win'" })};   -- 202610020001: how the duel ended
    do $$begin
      ${refusedAs('insufficient_privilege', 'perform * from public.duel_metrics', 'A guest can read duel_metrics')}
      ${refusedAs('insufficient_privilege', 'update public.duel_metrics set desyncs = 0', 'A guest can update duel_metrics')}
      ${refusedAs('insufficient_privilege', 'delete from public.duel_metrics', 'A guest can delete duel_metrics')}
      ${refusedAs('insufficient_privilege', 'perform public.prune_duel_metrics()', 'A guest can prune duel_metrics')}
      ${[{ side: 2 }, { path: "'turn'" }, { candidate: "'mdns'" }, { room: "'ROOM!'" }, { frames: 0 }, { depth_p95: 9, max_depth: 8 }, { delay: 4, max_delay: 3 },
        { rtt_p50_ms: 80, rtt_p95_ms: 70 }, { rollbacks_per_min: "'NaN'" }, { ua: "repeat('a', 301)" }, { revision: "'main'" }, { result: "'win'" }, { result: "'forfeit'" },
        { reconnects: -1 }, { reconnects: 1001 }]
        .map(over => refusedAs('check_violation', duelRow(over), `Duel metrics with ${JSON.stringify(over).replace(/'/g, '')} were stored`)).join('\n      ')}
    end$$;
    reset role;
    do $$begin
      if (select count(*) from public.duel_metrics) <> 2 then raise exception 'duel_metrics should hold exactly the two rows sent'; end if;
    end$$;
    -- Backend review (2026-10-01): the same bounds the perf_beacons block proves. A signed-in client inserts and nothing else.
    set role authenticated;
    ${duelRow({ side: 1, result: "'no-contest'", reconnects: 3 })};   -- a signed-in client stores a result and its reconnects (202610030001) too
    do $$begin
      ${refusedAs('insufficient_privilege', 'perform * from public.duel_metrics', 'A signed-in client can read duel_metrics')}
      ${refusedAs('insufficient_privilege', 'update public.duel_metrics set desyncs = 0', 'A signed-in client can update duel_metrics')}
      ${refusedAs('insufficient_privilege', 'delete from public.duel_metrics', 'A signed-in client can delete duel_metrics')}
      ${refusedAs('insufficient_privilege', 'truncate public.duel_metrics', 'A signed-in client can truncate duel_metrics')}
      ${refusedAs('insufficient_privilege', 'perform public.prune_duel_metrics()', 'A signed-in client can prune duel_metrics')}
      ${refusedAs('insufficient_privilege', duelRow({ created_at: "'2000-01-01'" }), 'A client set created_at on duel metrics')}
    end$$;
    reset role;
    -- The minute cap: 60, per row, so one bulk insert cannot pass it.
    set role anon;
    do $$begin
      for i in 1..56 loop ${duelRow()}; end loop; ${duelRow({ result: "'forfeit-loss'" })};   -- 60 this minute, the last one a forfeit-loss: every result in the closed set is stored once
      ${refusedAs('insufficient_privilege', duelRow(), 'A 61st duel metrics row within the minute was stored')}
    end$$;
    reset role;
    update public.duel_metrics set created_at = now() - interval '2 minutes';   -- the minute window clear; all 60 still today
    set role anon;
    do $$begin
      ${refusedAs('insufficient_privilege', duelRow().replace(/values \((.*)\)$/, 'select $1 from generate_series(1, 61)'), 'A bulk insert of 61 passed the duel metrics minute cap')}
    end$$;
    reset role;
    do $$begin if (select count(*) from public.duel_metrics) <> 60 then raise exception 'A refused duel metrics bulk insert left rows behind'; end if; end$$;
    -- The day cap: 5000.
    alter table public.duel_metrics disable trigger duel_metrics_rate;
    insert into public.duel_metrics (revision, room, side, path, frames, rollbacks_per_min, depth_p95, max_depth, stalls_per_min, delay, max_delay, desyncs, ua)
      select '026d07e4', 'k3v9q2x7m1', 0, 'direct', 1, 0, 0, 0, 0, 0, 0, 0, 'x' from generate_series(1, 4940);
    update public.duel_metrics set created_at = now() - interval '1 hour' where created_at > now() - interval '1 minute';
    alter table public.duel_metrics enable trigger duel_metrics_rate;
    set role anon;
    do $$begin ${refusedAs('insufficient_privilege', duelRow(), 'A 5001st duel metrics row within the day was stored')} end$$;
    reset role;
    -- Retention: 90 days.
    update public.duel_metrics set created_at = now() - interval '91 days' where id in (select id from public.duel_metrics order by id limit 5);
    do $$declare n integer; begin
      n := public.prune_duel_metrics();
      if n <> 5 then raise exception 'Pruned % duel metrics rows, expected the 5 old ones', n; end if;
      if (select count(*) from public.duel_metrics) <> 4995 then raise exception 'Pruning removed a recent duel metrics row'; end if;
    end$$;
    do $$begin
      if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        if not exists (select 1 from cron.job where jobname = 'frankendom_duel_metrics_retention' and schedule = '29 4 * * *' and command = 'select public.prune_duel_metrics()' and active) then
          raise exception 'The duel metrics retention cron job is missing or wrong';
        end if;
      else
        raise notice 'pg_cron is not available on this cluster: the duel metrics retention job row is verified live after apply, not here';
      end if;
    end$$;
    delete from public.duel_metrics;`;
  // fight_results (Pit skull walls): AI rows from the owner's own client only; duel rows only through report_duel (two agreeing reports) or
  // settle_forfeits (a lone forfeit-win held 90 seconds), the identities coming from the start rows.
  const fightResults = `
    reset role;
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    insert into public.fight_results(kind,opponent_key,opponent_name,opponent_level,result) values ('ai','goblin-1','Goblin',1,'win'),('ai','goblin-2','Goblin',2,'loss');
    do $$begin
      begin insert into public.fight_results(kind,opponent_key,opponent_name,opponent_level,result,room) values ('duel','x','x',1,'win','abcd0001'); raise exception 'Client duel row allowed'; exception when insufficient_privilege then null; end;
      begin insert into public.fight_results(user_id,kind,opponent_key,opponent_name,opponent_level,result) values ('22222222-2222-4222-8222-222222222222','ai','goblin-1','G',1,'win'); raise exception 'Cross-owner result allowed'; exception when insufficient_privilege then null; end;
      begin perform * from public.duel_reports; raise exception 'Duel reports readable'; exception when insufficient_privilege then null; end;
      begin perform * from public.duel_starts; raise exception 'Duel starts readable'; exception when insufficient_privilege then null; end;
      begin perform public.settle_forfeits(); raise exception 'settle_forfeits callable by a client'; exception when insufficient_privilege then null; end;
      begin perform public.report_duel('abcd1234','win','0123456789abcdef'); raise exception 'Report without start allowed'; exception when insufficient_privilege then null; end;
      if (select ranks_beaten from public.pit_ai_standing() where opponent = 'goblin') <> '{1}' then raise exception 'pit_ai_standing ranks wrong'; end if;
      perform public.report_duel_start('abcd1234','Aldren',5,'{"Helmet":"a"}');
      if public.report_duel('abcd1234','win','0123456789abcdef') then raise exception 'Lone report paired'; end if;
    end$$;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      perform public.report_duel_start('abcd1234','Bo',6,'{}');
      if public.report_duel('abcd1234','win','0123456789abcdef') then raise exception 'Two wins paired'; end if;
      if public.report_duel('abcd1234','loss','0123456789abcdef') then raise exception 'First report was replaced'; end if;
      perform public.report_duel_start('room0002','Bo',6,'{}');
      if public.report_duel('room0002','loss','aaaaaaaaaaaaaaaa') then raise exception 'Lone report paired'; end if;
    end$$;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    do $$begin
      perform public.report_duel_start('room0002','Aldren',5,'{"Helmet":"a"}');
      if not public.report_duel('room0002','win','aaaaaaaaaaaaaaaa') then raise exception 'Agreeing pair not written'; end if;
      if (select count(*) from public.fight_results where kind = 'duel') <> 1 then raise exception 'Duel row count wrong'; end if;
      if exists (select 1 from public.pit_duel_beaten() where opponent_key = '22222222-2222-4222-8222-222222222222' or opponent_name <> 'Bo' or wins <> 1) then raise exception 'pit_duel_beaten leaks the auth id or is wrong'; end if;
      perform public.report_duel_start('room0003','Aldren',5,'{}');
      if public.report_duel('room0003','forfeit-win',null) then raise exception 'Forfeit paired with only one player registered'; end if;
    end$$;
    reset role;
    do $$begin if exists (select 1 from public.duel_reports where room = 'room0003') then raise exception 'Forfeit stored with only one player registered'; end if; end$$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    select public.report_duel_start('room0003','Bo',6,'{}');
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    do $$begin
      if public.report_duel('room0003','forfeit-win',null) then raise exception 'Forfeit written at once'; end if;
    end$$;
    reset role;
    update public.duel_reports set created_at = now() - interval '2 minutes' where room = 'room0003';
    do $$begin
      if public.settle_forfeits() <> 1 then raise exception 'Held forfeit did not settle'; end if;
      if (select count(*) from public.fight_results where room = 'room0003' and user_id = '11111111-1111-4111-8111-111111111111' and result = 'win') <> 1
        or (select count(*) from public.fight_results where room = 'room0003' and user_id = '22222222-2222-4222-8222-222222222222' and result = 'loss') <> 1 then raise exception 'Forfeit pair wrong'; end if;
    end$$;
    -- a forfeit the other player contradicts is never settled
    insert into public.duel_starts(room,user_id,name,level) values ('room0004','11111111-1111-4111-8111-111111111111','Aldren',5),('room0004','22222222-2222-4222-8222-222222222222','Bo',6);
    insert into public.duel_reports(room,user_id,result,hash,created_at) values ('room0004','11111111-1111-4111-8111-111111111111','forfeit-win',null,now() - interval '2 minutes'),('room0004','22222222-2222-4222-8222-222222222222','loss','bbbbbbbbbbbbbbbb',now());
    do $$begin if public.settle_forfeits() <> 0 or exists (select 1 from public.fight_results where room = 'room0004') then raise exception 'Contradicted forfeit settled'; end if; end$$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      if (select count(*) from public.fight_results where kind = 'duel') <> 2 then raise exception 'Second fighter sees the wrong rows'; end if;
    end$$;
    reset role;
    -- the Auditor's B2: A claims a forfeit early, the fight runs past the hold, the forfeit settles, then B honestly reports the win. The claim is withdrawn.
    insert into public.duel_starts(room,user_id,name,level) values ('room0006','11111111-1111-4111-8111-111111111111','Ay',5),('room0006','22222222-2222-4222-8222-222222222222','Bee',6);
    insert into public.duel_reports(room,user_id,result,hash,created_at) values ('room0006','11111111-1111-4111-8111-111111111111','forfeit-win',null,now() - interval '2 minutes');
    do $$begin if public.settle_forfeits() <> 1 then raise exception 'Setup: the lone forfeit did not settle'; end if; end$$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin
      if public.report_duel('room0006','win','cccccccccccccccc') then raise exception 'B2: the honest winner was paired with a withdrawn forfeit'; end if;
    end$$;
    reset role;
    do $$begin
      if exists (select 1 from public.fight_results where room = 'room0006') then raise exception 'B2: the forfeit rows survived the other player report'; end if;
      if exists (select 1 from public.duel_reports where room = 'room0006' and result = 'forfeit-win') then raise exception 'B2: the forfeit report survived'; end if;
    end$$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    do $$begin
      if not public.report_duel('room0006','loss','cccccccccccccccc') then raise exception 'B2: the honest pair did not write after the withdrawal'; end if;
    end$$;
    reset role;
    do $$begin
      if (select result from public.fight_results where room = 'room0006' and user_id = '22222222-2222-4222-8222-222222222222') <> 'win' then raise exception 'B2: B does not hold the win'; end if;
    end$$;
    -- a forfeit older than 10 minutes is final
    insert into public.duel_starts(room,user_id,name,level) values ('room0007','11111111-1111-4111-8111-111111111111','Ay',5),('room0007','22222222-2222-4222-8222-222222222222','Bee',6);
    insert into public.duel_reports(room,user_id,result,hash,created_at) values ('room0007','11111111-1111-4111-8111-111111111111','forfeit-win',null,now() - interval '11 minutes');
    do $$begin if public.settle_forfeits() <> 1 then raise exception 'Setup: the old forfeit did not settle'; end if; end$$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
    do $$begin perform public.report_duel('room0007','win','dddddddddddddddd'); end$$;
    reset role;
    do $$begin if (select count(*) from public.fight_results where room = 'room0007') <> 2 then raise exception 'A forfeit older than 10 minutes was revoked'; end if; end$$;
    -- retention: rows older than a day are deleted
    insert into public.duel_starts(room,user_id,name,level,created_at) values ('room0008','11111111-1111-4111-8111-111111111111','Ay',5,now() - interval '2 days');
    do $$begin perform public.settle_forfeits(); if exists (select 1 from public.duel_starts where room = 'room0008') then raise exception 'Old registration kept'; end if; end$$;
    delete from public.fight_results; delete from public.duel_reports; delete from public.duel_starts;`;

  run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], bootstrap + migrations + checks + creatures + fightRecords + dailyLoot + dailySummary + shortShare + guestHygiene + perfBeacons + duelMetrics + fightResults);
  // The Auditor's B3: two reports of one room that overlap pair (the per-room advisory lock makes the second wait for the first).
  const asUser = (sub, sql) => new Promise((resolve, reject) => {
    const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-tA'], { env }); let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => (code ? reject(new Error(err)) : resolve(out.trim().split('\n'))));
    child.stdin.end(`set role authenticated; select set_config('request.jwt.claim.sub','${sub}',false) \\gset\n${sql}`);
  });
  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
  run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], `insert into public.duel_starts(room,user_id,name,level) values ('room0009','${A}','Ay',5),('room0009','${B}','Bee',6);`);
  const [, second] = await Promise.all([
    asUser(A, "begin; select public.report_duel('room0009','win','eeeeeeeeeeeeeeee'); select pg_sleep(1.5); commit;"),
    new Promise((r) => setTimeout(r, 500)).then(() => asUser(B, "select public.report_duel('room0009','loss','eeeeeeeeeeeeeeee');")),
  ]);
  const answer = second.at(-1);
  if (answer !== 't') throw new Error(`B3: overlapping reports of one room did not pair (second returned ${answer})`);
  run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], "do $$begin if (select count(*) from public.fight_results where room = 'room0009') <> 2 then raise exception 'B3: rows after the race'; end if; end$$; delete from public.fight_results; delete from public.duel_reports; delete from public.duel_starts;");
  console.log('Account database PASS: fight_results (own AI rows; duel rows only from two agreeing reports or a held forfeit revocable for 10 min; per-room lock; retention); owner-writable bounded marks column; real PostgreSQL; owner read/write, two-user isolation, anon denial, immutable owner/revision, stale-save rejection, input constraints, no client deletes; fight_records column-limited public read (id, opponent, record only), no anonymous write; perf beacons insert-only on their listed columns, every column range-checked, no identity or address column, minute and day caps per row, 90-day prune, device spread service-only. No hosted database changed.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
