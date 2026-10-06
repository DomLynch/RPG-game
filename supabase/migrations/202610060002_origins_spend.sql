begin;
-- ROLLBACK: supabase/down/202610060002_origins_spend_down.sql.
-- Origins spend (follow-up to 202610060001_origins_save.sql; Lead's ruling 2026-10-07 on Expansion's consume/apply_upgrade gap). ADDITIVE, Origins-only:
-- three more event kinds, 'burn', 'upgrade' and 'paid', one read of a single stored event, one list of unpaid quest rewards, so a retried spend can be told apart from a different one and
-- answered with its original receipt. The writer writes burn:<character>:<op> / upgrade:<character>:<op> {payload} in the SAME batch as the burn/put ops,
-- so the event's primary key aborts a replay (O0001) and the writer then reads the stored payload back through origins_event. No coin here (Strategy/Stats
-- have not ruled). No existing table, function or privilege outside origins_* is touched; the flag stays OFF and no rows are written by this file.
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid'));

-- One stored event of THIS account, or null: another account's id, an unknown id and an account that is not open all read the same, so ids cannot be probed.
create function public.origins_event(p_account uuid, p_event_id text) returns jsonb language sql stable security definer set search_path = '' as $$
  select (select to_jsonb(e) from public.origins_events e where e.event_id = p_event_id and e.account = p_account and public.origins_allowed(p_account))
$$;

-- Reward lines the writer could not pay yet (loot, faction standing: no rows to pay them into). The writer records them on the quest-stage event as
-- payload.unpaid; a later payer lists them here, pays, and books paid:<event_id> {lines} in the same batch as its writes, which takes the event off this list.
create function public.origins_unpaid(p_account uuid) returns table (event_id text, "character" text, payload jsonb, at timestamptz) language sql stable security definer set search_path = '' as $$
  select e.event_id, e.character, e.payload, e.at
  from public.origins_events e
  where e.account = p_account and public.origins_allowed(p_account) and e.kind = 'quest-stage'
    and jsonb_typeof(e.payload -> 'unpaid') = 'array' and jsonb_array_length(e.payload -> 'unpaid') > 0
    and not exists (select 1 from public.origins_events x where x.event_id = 'paid:' || e.event_id)
  order by e.at, e.event_id
$$;
revoke all on function public.origins_event(uuid, text), public.origins_unpaid(uuid) from public, anon, authenticated;
grant execute on function public.origins_event(uuid, text), public.origins_unpaid(uuid) to frankendom_origins;
commit;
