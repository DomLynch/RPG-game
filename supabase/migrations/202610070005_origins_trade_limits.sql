begin;
-- DRAFT, NOT FOR APPLY. No PRE, no apply until Strategy + Lead's joint GO (Dom too for any class 2 statement).
-- ROLLBACK: supabase/down/202610070005_origins_trade_limits_down.sql (valid only while no 'trade-reversal'/'trade-hold'/'metal' event exists).
-- Origins trade limits, slice 1 of 0005 (docs/specs/origins/trading.md §6 M9, M10, M11, M13). Origins-only; the flag is OFF and the tables hold no rows.
--   M9  the per-item trade cooldown (economy.ts tradeCooldown, no hard limit: Dom 2026-10-07): the DB writes the 'trade' history entry itself (0003's guard forbids
--       a client-sent history_append) and refuses a piece entering escrow before its cooldown ends.
--   M10 origins_expire_trades(): the open trades the writer must now cancel (past expires_at, or idle too long).
--   M11 three more event kinds.   M13 config rows for the cooldown and the idle expiry.
-- Slice 2 (this file too): M12 audit table + record/prune + purge replace, M13 gates/caps config + origins_trade_limits(), M14 origins_trade_counts + origins_reverse_trade.
-- Slice 3 (not in this file yet): M15 bound metals.

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
  if not (new.loc_kind is not distinct from 'trade-escrow' and (tg_op = 'INSERT' or old.loc_kind is distinct from 'trade-escrow' or old.loc_container is distinct from new.loc_container)) then return new; end if;   -- null-safe: a retirement nulls loc_kind
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

-- ---- M12: the trade audit trail (docs/specs/origins/trading.md §5.7) ----------------------------------------------------------------
-- Who opened, offered, accepted: session, device, hashed IP, UA family. Written by the writer through the record function only; no client reads it.
-- 90 days (the prune function below); erased with the account (origins_purge_account, replaced below).
create table public.origins_trade_audit (
  id bigint generated always as identity primary key,
  container text not null check (char_length(container) between 3 and 120),
  account uuid not null references auth.users (id) on delete cascade,
  character text references public.origins_characters (id) on delete set null,
  session_id text check (char_length(session_id) <= 120), device_hash text check (char_length(device_hash) <= 120), ip_hash text check (char_length(ip_hash) <= 120), ua_family text check (char_length(ua_family) <= 60),
  at timestamptz not null default now()
);
create index origins_trade_audit_account on public.origins_trade_audit (account, at desc);
create index origins_trade_audit_at on public.origins_trade_audit (at);
alter table public.origins_trade_audit enable row level security;
revoke all on public.origins_trade_audit from public, anon, authenticated;

create function public.origins_trade_audit_record(p_container text, p_account uuid, p_character text, p_session text, p_device text, p_ip text, p_ua text) returns void language sql security definer set search_path = '' as $$
  insert into public.origins_trade_audit (container, account, character, session_id, device_hash, ip_hash, ua_family) values (p_container, p_account, p_character, p_session, p_device, p_ip, p_ua)
$$;
create function public.origins_trade_audit_prune(p_days int default 90) returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_days is null or p_days < 1 then raise exception 'prune keeps at least one day' using errcode = 'O0012'; end if;
  delete from public.origins_trade_audit where at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- 0001's purge with one more delete (the audit rows hang off auth.users, not the characters, so the character delete does not reach them).
create or replace function public.origins_purge_account(p_account uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare chars int; evs int; its int;
begin
  perform set_config('origins.purge', 'on', true);
  select count(*) into its from public.origins_items where holder_account = p_account and retired_at is null;
  delete from public.origins_events where account = p_account;
  get diagnostics evs = row_count;
  delete from public.origins_trade_audit where account = p_account;
  delete from public.origins_characters where account = p_account;
  get diagnostics chars = row_count;
  delete from public.origins_career where account = p_account;
  delete from public.origins_access where account = p_account;
  perform set_config('origins.purge', 'off', true);
  return jsonb_build_object('characters', chars, 'events', evs, 'live_items', its);
end $$;

-- ---- M13: the gates and caps (§5.3, §5.5), config rows so Strategy moves them without a migration -----------------------------------
-- Enforced by the WRITER from origins_trade_limits() below; the database enforces item invariants only. `origin_tiers` names the tiers the origin-tier cap counts
-- (OPEN: the tier name is not confirmed, so it is a list a config update can change).
insert into public.origins_config (key, value) values
  ('trade_gates', '{"min_career_level": 11, "account_age_s": 604800, "origins_age_s": 172800, "new_device_cooldown_s": 259200}'::jsonb),
  ('trade_caps', '{"window_s": 86400, "open": 1, "settled": 10, "pieces": 20, "counterparties": 5, "origin_tier": 2, "origin_tiers": ["origin"]}'::jsonb);

-- ---- M14: counts for the caps, and the reversal ---------------------------------------------------------------------------------------
-- What one account has done since p_since: open trades now, settled trades, distinct counterparties, pieces given (history 'trade' entries whose `from`
-- character is the account's) and how many of those were of the origin tiers.
create function public.origins_trade_counts(p_account uuid, p_since timestamptz) returns jsonb language sql stable security definer set search_path = '' as $$
  with mine as (select id from public.origins_characters where account = p_account),
  tr as (select t.*, (select c.account from public.origins_characters c where c.id = case when t.side_a in (select id from mine) then t.side_b else t.side_a end) as other
         from public.origins_trades t where t.side_a in (select id from mine) or t.side_b in (select id from mine)),
  given as (select i.tier, e from public.origins_items i, jsonb_array_elements(i.history) e
            where e ->> 'kind' = 'trade' and (e ->> 'at')::timestamptz >= p_since and (e ->> 'from') in (select id from mine))
  select jsonb_build_object(
    'open', (select count(*) from tr where state = 'open'),
    'settled', (select count(*) from tr where state = 'settled' and settled_at >= p_since),
    'counterparties', (select count(distinct other) from tr where state = 'settled' and settled_at >= p_since and other is not null),
    'pieces', (select count(*) from given),
    'origin_tier', (select count(*) from given where tier in (select jsonb_array_elements_text(value -> 'origin_tiers') from public.origins_config where key = 'trade_caps')))
$$;

-- Everything the writer needs to allow or refuse an open/offer for an account in one read: the gates and caps from config, the account's age and origins age in
-- seconds, and its counts over the cap window. The career-level gate is the writer's (the level is derived from the career row, not stored as a number).
-- (plpgsql, not sql: auth.users.created_at is read at call time, so a function body is not checked against the auth schema at create, and every migration harness's
-- stub auth.users keeps working.)
create function public.origins_trade_limits(p_account uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caps jsonb; acct_age bigint; org_age bigint;
begin
  select value into caps from public.origins_config where key = 'trade_caps';
  select extract(epoch from now() - u.created_at)::bigint into acct_age from auth.users u where u.id = p_account;
  select extract(epoch from now() - a.granted_at)::bigint into org_age from public.origins_access a where a.account = p_account;
  return jsonb_build_object('gates', (select value from public.origins_config where key = 'trade_gates'), 'caps', caps, 'account_age_s', acct_age, 'origins_age_s', org_age,
    'counts', public.origins_trade_counts(p_account, now() - make_interval(secs => coalesce((caps ->> 'window_s')::int, 86400))));
end $$;

-- Reverse a settled trade (Dom, or Strategy on Dom's say; decision 18 of the spec): the reviewer must be in public.admins. Each put sends a piece the receiver
-- STILL holds back to the sender, and this function writes the {kind:'reversal'} history entry itself (a client-built put may not carry history_append). A piece
-- that has moved on since is not touched: the writer reports it. One reversal per trade: the event id carries the container, so a second hits O0001.
create function public.origins_reverse_trade(p_container text, p_reviewer uuid, p_reason text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; op jsonb; it public.origins_items; trade_entry jsonb; ops jsonb := '[]'::jsonb; acct uuid;
begin
  if not exists (select 1 from public.admins a where a.user_id = p_reviewer) then raise exception 'reviewer % is not an admin', p_reviewer using errcode = 'O0007'; end if;
  if p_reason is null or char_length(p_reason) not between 3 and 500 then raise exception 'a reversal needs a reason of 3 to 500 characters' using errcode = 'O0012'; end if;
  select * into t from public.origins_trades where container = p_container and state = 'settled' for update;
  if not found then raise exception 'trade % is not settled', p_container using errcode = 'O0002'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  if cardinality(accts) <> 2 then raise exception 'trade % lost a side: nothing to reverse to', p_container using errcode = 'O0002'; end if;
  for op in select * from jsonb_array_elements(p_batch) loop
    if op ->> 'op' <> 'put' then raise exception 'op % is not allowed in a reversal', op ->> 'op' using errcode = 'O0012'; end if;
    if op ?| array['upgrade_level', 'tier', 'bound_to', 'history_append'] then raise exception 'a reversal put moves a piece only' using errcode = 'O0012'; end if;
    select * into it from public.origins_items where id = op ->> 'id';
    if not found or it.retired_at is not null then raise exception 'put of % is not a live piece', op ->> 'id' using errcode = 'O0012'; end if;
    select e into trade_entry from jsonb_array_elements(it.history) e where e ->> 'kind' = 'trade' and e ->> 'trade' = p_container limit 1;
    if trade_entry is null then raise exception 'item % was not moved by trade %', it.id, p_container using errcode = 'O0012'; end if;
    if it.loc_kind not in ('pack', 'bank') or it.loc_owner is distinct from trade_entry ->> 'to' then raise exception 'item % is no longer held by the receiver', it.id using errcode = 'O0012'; end if;
    if (op #>> '{loc,kind}') not in ('pack', 'bank') or (op #>> '{loc,owner}') is distinct from trade_entry ->> 'from' then raise exception 'item % goes back to the sender''s pack or bank', it.id using errcode = 'O0012'; end if;
    ops := ops || jsonb_build_array(op || jsonb_build_object('history_append', jsonb_build_array(jsonb_build_object('kind', 'reversal', 'trade', p_container, 'from', it.loc_owner, 'to', op #>> '{loc,owner}', 'at', now()))));
  end loop;
  foreach acct in array accts loop
    ops := ops || jsonb_build_array(jsonb_build_object('op', 'event', 'event_id', 'trade-reversal:' || p_container || ':' || acct, 'kind', 'trade-reversal', 'account', acct,
      'payload', jsonb_build_object('trade', p_container, 'reviewer', p_reviewer, 'reason', p_reason)));
  end loop;
  return public.origins_apply(ops, accts);
end $$;

revoke all on function public.origins_trade_cooldown_s(int), public.origins_trade_cooldown_guard(), public.origins_trade_history(), public.origins_expire_trades(),
  public.origins_trade_audit_record(text, uuid, text, text, text, text, text), public.origins_trade_audit_prune(int), public.origins_trade_counts(uuid, timestamptz),
  public.origins_trade_limits(uuid), public.origins_reverse_trade(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.origins_expire_trades(), public.origins_trade_audit_record(text, uuid, text, text, text, text, text), public.origins_trade_audit_prune(int),
  public.origins_trade_counts(uuid, timestamptz), public.origins_trade_limits(uuid), public.origins_reverse_trade(text, uuid, text, jsonb) to frankendom_origins;
commit;
