begin;
-- DRAFT, NOT FOR APPLY. No PRE, no apply until Strategy + Lead's joint GO (Dom too for any class 2 statement).
-- ROLLBACK: supabase/down/202610070004_origins_trade_limits_down.sql (valid only while no 'trade-reversal'/'trade-hold'/'metal' event exists).
-- Origins trade limits, slice 1 of 0004 (docs/specs/origins/trading.md §6 M9, M10, M11, M13). Origins-only; the flag is OFF and the tables hold no rows.
--   M9  the per-item trade cooldown (economy.ts tradeCooldown, no hard limit: Dom 2026-10-07): the DB writes the 'trade' history entry itself (0003's guard forbids
--       a client-sent history_append) and refuses a piece entering escrow before its cooldown ends.
--   M10 origins_expire_trades(): the open trades the writer must now cancel (past expires_at, or idle too long).
--   M11 three more event kinds.   M13 config rows for the cooldown and the idle expiry.
-- Later slices (M12 audit, M13 caps, M14 reversal, M15 metals) are not in this file yet.

-- ---- M13 (part): config the functions below read, tunable without a migration --------------------------------------------------------
insert into public.origins_config (key, value) values
  ('trade_cooldown', '{"first": 259200, "steps": [604800, 1209600, 2592000]}'::jsonb),   -- seconds: first offer after mint, then by hop count (last step repeats)
  ('trade_idle_expiry_s', '300'::jsonb);

-- ---- M11: the event kinds (an Origins table constraint replace) --------------------------------------------------------------------------
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid', 'trade', 'trade-cancel', 'trade-reversal', 'trade-hold', 'metal'));

-- ---- M9: the cooldown --------------------------------------------------------------------------------------------------------------
-- Seconds a piece with `hops` completed trades must wait after its last trade (or its mint) before it may be offered again.
create function public.origins_trade_cooldown_s(p_hops int) returns bigint language sql stable security definer set search_path = '' as $$
  select case when p_hops <= 0 then (c.value ->> 'first')::bigint
    else (c.value -> 'steps' ->> (least(p_hops, jsonb_array_length(c.value -> 'steps')) - 1))::bigint end
  from public.origins_config c where c.key = 'trade_cooldown'
$$;

-- Entering escrow: refuse while cooling. Same enter test as origins_escrow_guard; the clock is the last 'trade' history entry's `at`, else provenance.at.
create function public.origins_trade_cooldown_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare hops int; since timestamptz; wait_s bigint;
begin
  if not (new.loc_kind = 'trade-escrow' and (tg_op = 'INSERT' or old.loc_kind is distinct from 'trade-escrow' or old.loc_container is distinct from new.loc_container)) then return new; end if;
  select count(*), max((e ->> 'at')::timestamptz) into hops, since from jsonb_array_elements(new.history) e where e ->> 'kind' = 'trade';
  since := coalesce(since, (new.provenance ->> 'at')::timestamptz);
  wait_s := public.origins_trade_cooldown_s(hops);
  if since is null or wait_s is null then raise exception 'item % has no readable trade clock', new.id using errcode = 'O0012'; end if;
  if now() < since + make_interval(secs => wait_s) then
    raise exception 'item % is cooling down until %', new.id, since + make_interval(secs => wait_s) using errcode = 'O0012'; end if;
  return new;
end $$;
create trigger origins_trade_cooldown_guard before insert or update on public.origins_items for each row execute function public.origins_trade_cooldown_guard();

-- Leaving escrow into another character's pack or bank is a completed trade: append {kind:'trade', trade, from, to, at}. A cancel returns the piece to loc_from: no entry.
create function public.origins_trade_history() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.loc_kind = 'trade-escrow' and new.loc_kind in ('pack', 'bank') and new.loc_owner is distinct from old.loc_from
     and coalesce(current_setting('origins.trade', true), '') = 'on' then
    new.history := new.history || jsonb_build_array(jsonb_build_object('kind', 'trade', 'trade', old.loc_container, 'from', old.loc_from, 'to', new.loc_owner, 'at', now()));
  end if;
  return new;
end $$;
create trigger origins_trade_history before update on public.origins_items for each row execute function public.origins_trade_history();

-- ---- M10: which open trades must be cancelled now -------------------------------------------------------------------------------------
-- Read-only; the writer cancels each through origins_cancel_trade(container, 'expired'|'timeout', batch) (the return puts are the writer's to build).
create function public.origins_expire_trades() returns table (container text, reason text) language sql stable security definer set search_path = '' as $$
  select t.container, case when t.expires_at is not null and t.expires_at <= now() then 'expired' else 'timeout' end
  from public.origins_trades t
  where t.state = 'open' and ((t.expires_at is not null and t.expires_at <= now())
    or t.last_change_at <= now() - make_interval(secs => coalesce((select (value #>> '{}')::int from public.origins_config where key = 'trade_idle_expiry_s'), 300)))
  order by t.created_at
$$;

revoke all on function public.origins_trade_cooldown_s(int), public.origins_trade_cooldown_guard(), public.origins_trade_history(), public.origins_expire_trades() from public, anon, authenticated;
grant execute on function public.origins_expire_trades() to frankendom_origins;
commit;
