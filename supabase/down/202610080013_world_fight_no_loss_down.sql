begin;
-- Undo 202610080013_world_fight_no_loss.sql: the sweep goes back to 0002's body exactly (every expired fight is a loss by abandonment, with its event); the new read function,
-- the 12-argument start overload and the `world` column are dropped (0002's 11-argument start is untouched by the up file).
create or replace function public.origins_encounter_expire(p_limit int) returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; t record;
begin
  for t in select e.token, e.account, e.character, r.last_tick from public.origins_encounters e join public.origins_encounter_runs r on r.token = e.token
           where e.used_at is null and r.settled_at is null and e.expires_at <= now() order by e.expires_at limit greatest(least(p_limit, 500), 1) for update of e, r skip locked loop
    update public.origins_encounters set used_at = now() where token = t.token;
    update public.origins_encounter_runs set settled_at = now(), result = 'abandoned' where token = t.token;
    delete from public.origins_creature_claims where token = t.token;
    insert into public.origins_events (event_id, kind, account, character, payload) values ('enc:' || t.token, 'mob', t.account, t.character, jsonb_build_object('result', 'abandoned', 'ticks', t.last_tick));
    n := n + 1;
  end loop;
  return n;
end $$;
drop function if exists public.origins_last_paid_kill_at(uuid, text);
drop function if exists public.origins_encounter_start(uuid, text, text, bigint, text, int, int, int, jsonb, text, text, boolean);
alter table public.origins_encounter_runs drop column if exists world;
commit;
