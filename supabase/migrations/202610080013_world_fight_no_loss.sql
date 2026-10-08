begin;
-- ROLLBACK: supabase/down/202610080013_world_fight_no_loss_down.sql (restores 0002's sweep body exactly, drops the new function, the start overload and the column).
-- Dom 2026-10-08 (via Strategy, his words are the sign-off): "its real world, real time, there is no counting a loss or anything, if someone attacks u, either u die, kill them,
-- or run away/stalemate, thats fine." In a Zone 1 WORLD fight a kill is a win (paid), a death is a death, and running away or a stalemate records NOTHING.
-- (i)   CLASS 1: origins_encounter_runs.world (default false = today's behaviour), set by the SERVER at start from its own resolve() (encounters.ts kind 'world-mob'), never
--       from the client, through a new 12-argument origins_encounter_start overload that calls the unchanged 11-argument one (a writer still on the old call keeps working
--       and its fights stay world = false). Open runs at apply are backfilled to true: every encounter token so far is a Region 1 world-mob fight.
-- (ii)  CLASS 2: origins_encounter_expire (0002) is replaced. An expired open WORLD fight (never played, or played and left) is closed the same way (token used, run settled,
--       creature claim released, FOR UPDATE SKIP LOCKED) but writes NO origins_events row. A non-world fight is swept exactly as before: one 'abandoned' loss event.
-- (iii) CLASS 1: origins_last_paid_kill_at, the TIME of the account's newest PAID kill of a fight. The writer keys the fight's seed on it (HMAC with a server secret): the
--       creature keeps its fight across walk-aways and deaths, and only a paid kill (its respawn) brings a new seed, so a free walk-away cannot be used to shop for seeds.
alter table public.origins_encounter_runs add column world boolean not null default false;
update public.origins_encounter_runs set world = true where settled_at is null;
create function public.origins_encounter_start(p_account uuid, p_character text, p_token text, p_seed bigint, p_enemy text, p_level int, p_start_tick int, p_bar int, p_flags jsonb, p_layer text, p_instance text, p_world boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.origins_encounter_start(p_account, p_character, p_token, p_seed, p_enemy, p_level, p_start_tick, p_bar, p_flags, p_layer, p_instance);   -- 0002's start, unchanged
  update public.origins_encounter_runs set world = coalesce(p_world, false) where token = p_token;
  return public.origins_encounter_get(p_account, p_token);
end $$;
create or replace function public.origins_encounter_expire(p_limit int) returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; t record;
begin
  for t in select e.token, e.account, e.character, r.last_tick, r.world from public.origins_encounters e join public.origins_encounter_runs r on r.token = e.token
           where e.used_at is null and r.settled_at is null and e.expires_at <= now() order by e.expires_at limit greatest(least(p_limit, 500), 1) for update of e, r skip locked loop
    update public.origins_encounters set used_at = now() where token = t.token;
    update public.origins_encounter_runs set settled_at = now(), result = 'abandoned' where token = t.token;   -- a world run: internal bookkeeping only, nothing recorded or shown
    delete from public.origins_creature_claims where token = t.token;
    if not t.world then
      insert into public.origins_events (event_id, kind, account, character, payload) values ('enc:' || t.token, 'mob', t.account, t.character, jsonb_build_object('result', 'abandoned', 'ticks', t.last_tick));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
create function public.origins_last_paid_kill_at(p_account uuid, p_fight text) returns timestamptz language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  return (select e.at from public.origins_events e
          where e.account = p_account and e.kind = 'mob' and e.payload ->> 'fight' = p_fight and e.payload ->> 'paid' = 'true' order by e.at desc limit 1);
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation (#1639): revoke them, then grant the two writer roles only. `create or replace` keeps the
-- sweep's existing grants; they are restated so the file alone says who may call it.
revoke all on function public.origins_encounter_start(uuid, text, text, bigint, text, int, int, int, jsonb, text, text, boolean), public.origins_last_paid_kill_at(uuid, text),
  public.origins_encounter_expire(int) from public, anon, authenticated;
grant execute on function public.origins_encounter_start(uuid, text, text, bigint, text, int, int, int, jsonb, text, text, boolean), public.origins_last_paid_kill_at(uuid, text),
  public.origins_encounter_expire(int) to frankendom_origins, frankendom_verifier;
commit;
