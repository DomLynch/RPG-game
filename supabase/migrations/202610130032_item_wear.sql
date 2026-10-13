begin;
-- ROLLBACK: supabase/down/202610130032_item_wear_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE partial index and ONE read function. No table, existing function, grant or policy is altered; origins_apply is untouched.
-- Why (gear_repair): a piece's wear {worn, max, baseMax} is event-sourced, as a shop's shelf is (migration 202610080012). Every wear change and every repair writes an origins_events row
-- (kind 'metal', in the SAME origins_apply batch as the bronze spend and the burned materials) whose payload carries wear = {instance, worn, max, baseMax}. The current wear of a
-- piece is the row with the highest wear.seq (ties: newest at, then event_id); each wear write is its own event `wear:<instance>:<seq>`, so two writers that read the same wear collide on the primary key and the loser retries; no row = never worn. This reads back the newest row for each of a list of instances (an object keyed by instance; an unworn piece is simply absent), in one round trip.
create index origins_events_wear on public.origins_events (account, ((payload -> 'wear') ->> 'instance'), at desc) where kind = 'metal' and payload ? 'wear';
create function public.origins_item_wear(p_account uuid, p_instances text[]) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  return coalesce((select jsonb_object_agg(w.inst, w.wear) from (
    select distinct on ((e.payload -> 'wear') ->> 'instance') (e.payload -> 'wear') ->> 'instance' as inst, e.payload -> 'wear' as wear
    from public.origins_events e
    where e.account = p_account and e.kind = 'metal' and e.payload ? 'wear' and (e.payload -> 'wear') ->> 'instance' = any (p_instances)
    order by (e.payload -> 'wear') ->> 'instance', coalesce(((e.payload -> 'wear') ->> 'seq')::int, 0) desc, e.at desc, e.event_id desc) w), '{}'::jsonb);
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation: revoke them, then grant the two writer roles only.
revoke all on function public.origins_item_wear(uuid, text[]) from public, anon, authenticated;
grant execute on function public.origins_item_wear(uuid, text[]) to frankendom_origins, frankendom_verifier;
commit;
