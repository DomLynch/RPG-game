// Real PostgreSQL role/RLS verification in a disposable, socket-only cluster. Never touches a hosted project.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'frankendom-auth-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  const bootstrap = `create role anon; create role authenticated;
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
    do $$begin
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
    end$$;`;
  run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], bootstrap + migrations + checks + creatures);
  console.log('Account database PASS: real PostgreSQL; owner read/write, two-user isolation, anon denial, immutable owner/revision, stale-save rejection, input constraints, no client deletes. No hosted database changed.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
