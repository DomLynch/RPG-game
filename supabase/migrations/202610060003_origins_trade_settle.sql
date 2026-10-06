begin;
-- ROLLBACK: supabase/down/202610060003_origins_trade_settle_down.sql (valid only while no 'trade'/'trade-cancel' event exists and no one-of-each duplicate does).
-- Origins trading hardening (docs/specs/origins/trading.md §6, the BLOCKERS: Strategy + Backend ruling 2026-10-07). ADDITIVE, Origins-only, no row of any other
-- table is touched; the flag is OFF and the tables hold no rows. Guards against WRITER BUGS, not a compromised writer (the writer can already open any trade).
--   gap 1: settle did not check the accepts or the offer      -> offer_version + per-side accepted version and set; M4 change_offer, M5 accept_trade, M6 settle
--   gap 2: escrow could outlive its trade                     -> settle and cancel refuse while any live row of the container is still in escrow; M8 escrow guard
--   gap 3: a same-definition swap aborted (index is per row)  -> the one-of-each unique index becomes a deferred, advisory-locked count at commit (M17)
-- 0001 and 0002 are not edited: the old settle/cancel signatures are dropped and replaced, open_trade is replaced in place.

-- ---- M1: the acceptance columns --------------------------------------------------------------------------------------------------
alter table public.origins_trades
  add column offer_version int not null default 0,
  add column accepted_version_a int, add column accepted_version_b int,
  add column accepted_at_a timestamptz, add column accepted_at_b timestamptz,
  add column accepted_set_a jsonb, add column accepted_set_b jsonb,
  add column region text,
  add column expires_at timestamptz,
  add column last_change_at timestamptz not null default now(),
  add column cancel_reason text,
  add constraint origins_trades_cancel_reason check (cancel_reason is null or (state = 'cancelled' and cancel_reason in ('cancelled', 'expired', 'timeout', 'side-erased', 'reversed')));
-- One open trade per character (M2); the per-account rule is in origins_open_trade.
create unique index origins_trades_open_side_a on public.origins_trades (side_a) where state = 'open';
create unique index origins_trades_open_side_b on public.origins_trades (side_b) where state = 'open';
insert into public.origins_config (key, value) values ('trade_hard_expiry_s', '1200'::jsonb);   -- an open trade older than this is expired (tunable without a migration)

-- ---- M11: the event kinds a trade writes -----------------------------------------------------------------------------------------
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid', 'trade', 'trade-cancel'));

-- ---- M8: the escrow guard --------------------------------------------------------------------------------------------------------
-- A row enters or leaves 'trade-escrow' only inside the trade functions below (they set origins.trade for their own transaction), enters only for an open trade
-- the offerer is a side of, and only if it is a single-copy piece that is not bound. Account/character erasure deletes rows (not updates), so it is not blocked.
create function public.origins_escrow_guard() returns trigger language plpgsql set search_path = '' as $$
declare entering boolean; leaving boolean;
begin
  entering := new.loc_kind = 'trade-escrow' and (tg_op = 'INSERT' or old.loc_kind is distinct from 'trade-escrow' or old.loc_container is distinct from new.loc_container);
  leaving := tg_op = 'UPDATE' and old.loc_kind = 'trade-escrow' and (new.loc_kind is distinct from 'trade-escrow' or new.loc_container is distinct from old.loc_container);
  if not (entering or leaving) then return new; end if;
  if coalesce(current_setting('origins.trade', true), '') <> 'on' then raise exception 'trade-escrow changes only inside the trade functions' using errcode = 'O0012'; end if;
  if entering then
    if not new.single_copy or new.bound_to is not null then raise exception 'item % cannot be offered (only unbound single-copy pieces)', new.id using errcode = 'O0012'; end if;
    if not exists (select 1 from public.origins_trades t where t.container = new.loc_container and t.state = 'open' and new.loc_from in (t.side_a, t.side_b)) then
      raise exception 'escrow needs an open trade the offerer is a side of' using errcode = 'O0012'; end if;
  end if;
  return new;
end $$;
create trigger origins_escrow_guard before insert or update on public.origins_items for each row execute function public.origins_escrow_guard();

-- Every live escrow row of a container, by id: what both sides see on screen, and what an accept pins.
create function public.origins_escrow_set(p_container text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'version', i.version, 'from', i.loc_from) order by i.id), '[]'::jsonb)
  from public.origins_items i where i.retired_at is null and i.loc_kind = 'trade-escrow' and i.loc_container = p_container
$$;

-- ---- M3: open a trade (replaces 0001's, same signature) --------------------------------------------------------------------------
create or replace function public.origins_open_trade(p_container text, p_side_a text, p_side_b text) returns void language plpgsql security definer set search_path = '' as $$
declare acct_a uuid; acct_b uuid;
begin
  select a.account, b.account into acct_a, acct_b from public.origins_characters a, public.origins_characters b where a.id = p_side_a and b.id = p_side_b;
  if acct_a is null or not public.origins_allowed(acct_a) or not public.origins_allowed(acct_b) then raise exception 'origins is not open for both sides' using errcode = 'O0007'; end if;
  if acct_a = acct_b then raise exception 'a trade is between two accounts' using errcode = 'O0012'; end if;
  if exists (select 1 from public.origins_trades t join public.origins_characters c on c.id in (t.side_a, t.side_b) where t.state = 'open' and c.account in (acct_a, acct_b)) then
    raise exception 'an account is already in an open trade' using errcode = 'O0013'; end if;
  insert into public.origins_trades (container, side_a, side_b, expires_at)
  values (p_container, p_side_a, p_side_b, now() + make_interval(secs => coalesce((select (value #>> '{}')::int from public.origins_config where key = 'trade_hard_expiry_s'), 1200)));
end $$;

-- ---- M4: change one side's offer -------------------------------------------------------------------------------------------------
-- Only that side's own pieces, only into or out of THIS trade's escrow, only puts. Bumps offer_version and clears both accepts in the same statement.
create function public.origins_change_offer(p_container text, p_character text, p_expected_version int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; acct uuid; op jsonb; it public.origins_items; out jsonb;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  if t.expires_at is not null and now() > t.expires_at then raise exception 'trade % expired', p_container using errcode = 'O0002'; end if;
  if t.offer_version <> p_expected_version then raise exception 'trade % offer moved (version % vs %)', p_container, t.offer_version, p_expected_version using errcode = 'O0002'; end if;
  if p_character is null or p_character not in (coalesce(t.side_a, ''), coalesce(t.side_b, '')) then raise exception '% is not a side of trade %', p_character, p_container using errcode = 'O0010'; end if;
  select account into acct from public.origins_characters where id = p_character;
  if not public.origins_allowed(acct) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  for op in select * from jsonb_array_elements(p_batch) loop
    if op ->> 'op' <> 'put' then raise exception 'a change of offer is puts only' using errcode = 'O0012'; end if;
    select * into it from public.origins_items where id = op ->> 'id';
    if not found or it.retired_at is not null or it.holder_account is distinct from acct then raise exception 'item % is not this side''s to offer', op ->> 'id' using errcode = 'O0012'; end if;
    if (op #>> '{loc,kind}') = 'trade-escrow' then   -- offer: from this character's pack or bank into this trade's escrow, from this character
      if it.loc_kind not in ('pack', 'bank') or it.loc_owner <> p_character or (op #>> '{loc,container}') is distinct from p_container or (op #>> '{loc,from}') is distinct from p_character then
        raise exception 'item % can only be offered from this character into this trade', it.id using errcode = 'O0012'; end if;
    elsif it.loc_kind = 'trade-escrow' then   -- withdraw: back to this character's pack or bank
      if it.loc_container <> p_container or it.loc_from <> p_character or (op #>> '{loc,kind}') not in ('pack', 'bank') or (op #>> '{loc,owner}') is distinct from p_character then
        raise exception 'item % can only be withdrawn to its offerer', it.id using errcode = 'O0012'; end if;
    else raise exception 'item % is neither being offered nor withdrawn', it.id using errcode = 'O0012'; end if;
  end loop;
  perform set_config('origins.trade', 'on', true);
  out := public.origins_apply(p_batch, array[acct]);
  perform set_config('origins.trade', 'off', true);
  update public.origins_trades set offer_version = offer_version + 1, last_change_at = now(),
    accepted_version_a = null, accepted_version_b = null, accepted_at_a = null, accepted_at_b = null, accepted_set_a = null, accepted_set_b = null
  where container = p_container;
  return out;
end $$;

-- ---- M5: accept (or withdraw an accept) ------------------------------------------------------------------------------------------
-- The side comes from the character, never from the caller; the accepted set is READ here from the escrow, never supplied.
create function public.origins_accept_trade(p_container text, p_character text, p_offer_version int, p_accepted boolean) returns void language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; acct uuid; escrow jsonb;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  if t.expires_at is not null and now() > t.expires_at then raise exception 'trade % expired', p_container using errcode = 'O0002'; end if;
  if t.offer_version <> p_offer_version then raise exception 'trade % offer moved (version % vs %)', p_container, t.offer_version, p_offer_version using errcode = 'O0002'; end if;
  if p_character is null or p_character not in (coalesce(t.side_a, ''), coalesce(t.side_b, '')) then raise exception '% is not a side of trade %', p_character, p_container using errcode = 'O0010'; end if;
  select account into acct from public.origins_characters where id = p_character;
  if not public.origins_allowed(acct) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  escrow := public.origins_escrow_set(p_container);
  if p_character = t.side_a then
    update public.origins_trades set accepted_version_a = case when p_accepted then offer_version end, accepted_at_a = case when p_accepted then now() end,
      accepted_set_a = case when p_accepted then escrow end, last_change_at = now() where container = p_container;
  else
    update public.origins_trades set accepted_version_b = case when p_accepted then offer_version end, accepted_at_b = case when p_accepted then now() end,
      accepted_set_b = case when p_accepted then escrow end, last_change_at = now() where container = p_container;
  end if;
end $$;

-- ---- M6: settle (replaces 0001's two-argument form) ------------------------------------------------------------------------------
drop function public.origins_settle_trade(text, jsonb);
create function public.origins_settle_trade(p_container text, p_offer_version int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; out jsonb; escrow jsonb; op jsonb; it public.origins_items; other text; row jsonb; n int; moved text[] := '{}'; ver int;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  if t.expires_at is not null and now() > t.expires_at then raise exception 'trade % expired', p_container using errcode = 'O0002'; end if;
  if t.side_a is null or t.side_b is null then raise exception 'trade % lost a side: cancel it', p_container using errcode = 'O0002'; end if;
  if t.offer_version <> p_offer_version then raise exception 'trade % offer moved (version % vs %)', p_container, t.offer_version, p_offer_version using errcode = 'O0002'; end if;
  if t.accepted_version_a is distinct from t.offer_version or t.accepted_version_b is distinct from t.offer_version then
    raise exception 'trade % is not accepted by both sides at the current offer', p_container using errcode = 'O0012'; end if;
  escrow := public.origins_escrow_set(p_container);
  if t.accepted_set_a is distinct from escrow or t.accepted_set_b is distinct from escrow then raise exception 'trade % escrow differs from what was accepted', p_container using errcode = 'O0012'; end if;
  if jsonb_array_length(escrow) = 0 then raise exception 'trade % has nothing offered', p_container using errcode = 'O0012'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  for op in select * from jsonb_array_elements(p_batch) loop
    if op ->> 'op' = 'put' then
      select e into row from jsonb_array_elements(escrow) e where e ->> 'id' = op ->> 'id';
      if row is null then raise exception 'put of % is outside the accepted offer', op ->> 'id' using errcode = 'O0012'; end if;
      if op ->> 'id' = any (moved) then raise exception 'item % is moved twice', op ->> 'id' using errcode = 'O0012'; end if;
      moved := moved || (op ->> 'id');
      ver := (row ->> 'version')::int;
      if (op ->> 'expected_version')::int is distinct from ver then raise exception 'put of % is not at its accepted version', op ->> 'id' using errcode = 'O0012'; end if;
      other := case row ->> 'from' when t.side_a then t.side_b when t.side_b then t.side_a end;
      if other is null or (op #>> '{loc,kind}') not in ('pack', 'bank') or (op #>> '{loc,owner}') is distinct from other then
        raise exception 'item % goes to the other side''s pack or bank only', op ->> 'id' using errcode = 'O0012'; end if;
    elsif op ->> 'op' = 'event' then
      if op ->> 'kind' <> 'trade' or not ((op ->> 'account')::uuid = any (accts)) then raise exception 'a settle writes trade events for the two sides only' using errcode = 'O0012'; end if;
    else raise exception 'op % is not allowed in a settle', op ->> 'op' using errcode = 'O0012'; end if;
  end loop;
  if cardinality(moved) <> jsonb_array_length(escrow) then raise exception 'a settle moves every accepted piece' using errcode = 'O0012'; end if;
  perform set_config('origins.trade', 'on', true);
  out := public.origins_apply(p_batch, accts);
  perform set_config('origins.trade', 'off', true);
  select count(*) into n from public.origins_items where retired_at is null and loc_kind = 'trade-escrow' and loc_container = p_container;
  if n > 0 then raise exception 'trade % left % rows in escrow', p_container, n using errcode = 'O0002'; end if;
  update public.origins_trades set state = 'settled', settled_at = now(), last_change_at = now() where container = p_container;
  return out;
end $$;

-- ---- M7: cancel (replaces 0001's two-argument form) ------------------------------------------------------------------------------
drop function public.origins_cancel_trade(text, jsonb);
create function public.origins_cancel_trade(p_container text, p_reason text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; out jsonb; op jsonb; it public.origins_items; n int;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  if p_reason is null or p_reason not in ('cancelled', 'expired', 'timeout', 'side-erased') then raise exception 'cancel reason % is not one of cancelled, expired, timeout, side-erased', p_reason using errcode = 'O0012'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  for op in select * from jsonb_array_elements(p_batch) loop
    if op ->> 'op' = 'put' then   -- an escrowed piece goes back to its offerer's pack or bank
      select * into it from public.origins_items where id = op ->> 'id';
      if not found or it.retired_at is not null or it.loc_kind <> 'trade-escrow' or it.loc_container <> p_container then raise exception 'put of % is not an escrowed piece of this trade', op ->> 'id' using errcode = 'O0012'; end if;
      if (op #>> '{loc,kind}') not in ('pack', 'bank') or (op #>> '{loc,owner}') is distinct from it.loc_from then raise exception 'item % goes back to its offerer''s pack or bank', it.id using errcode = 'O0012'; end if;
    elsif op ->> 'op' = 'event' then
      if op ->> 'kind' <> 'trade-cancel' or not ((op ->> 'account')::uuid = any (accts)) then raise exception 'a cancel writes trade-cancel events for the two sides only' using errcode = 'O0012'; end if;
    else raise exception 'op % is not allowed in a cancel', op ->> 'op' using errcode = 'O0012'; end if;
  end loop;
  perform set_config('origins.trade', 'on', true);
  out := public.origins_apply(p_batch, accts);
  perform set_config('origins.trade', 'off', true);
  select count(*) into n from public.origins_items where retired_at is null and loc_kind = 'trade-escrow' and loc_container = p_container;
  if n > 0 then raise exception 'trade % left % rows in escrow', p_container, n using errcode = 'O0002'; end if;
  update public.origins_trades set state = 'cancelled', settled_at = now(), cancel_reason = p_reason, last_change_at = now() where container = p_container;
  return out;
end $$;

-- ---- M17: one of each, counted at commit -----------------------------------------------------------------------------------------
-- The unique index could not be deferred, so a swap of two copies of one definition failed mid-batch. Count at commit instead, under an advisory lock per
-- (holder, item) so two concurrent transactions cannot each add a copy and both pass (the second waits, then counts with a fresh snapshot). Same error class as
-- the index (23505) so the writer's 409 mapping holds; retired rows and a null holder (guild vault) are not counted, as the index's WHERE did.
drop index public.origins_items_one_of_each;
create function public.origins_one_of_each() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if new.single_copy and new.retired_at is null and new.holder_account is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.holder_account::text || '|' || new.item, 0));
    select count(*) into n from public.origins_items where holder_account = new.holder_account and item = new.item and single_copy and retired_at is null;
    if n > 1 then raise exception 'duplicate key value violates unique constraint "origins_items_one_of_each": % live copies of % on one account', n, new.item using errcode = '23505'; end if;
  end if;
  return null;
end $$;
create constraint trigger origins_one_of_each after insert or update on public.origins_items deferrable initially deferred for each row execute function public.origins_one_of_each();

revoke all on function public.origins_escrow_guard(), public.origins_escrow_set(text), public.origins_one_of_each(),
  public.origins_change_offer(text, text, int, jsonb), public.origins_accept_trade(text, text, int, boolean),
  public.origins_settle_trade(text, int, jsonb), public.origins_cancel_trade(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.origins_change_offer(text, text, int, jsonb), public.origins_accept_trade(text, text, int, boolean),
  public.origins_settle_trade(text, int, jsonb), public.origins_cancel_trade(text, text, jsonb) to frankendom_origins;
commit;
