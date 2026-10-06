begin;
-- Drops exactly what 202610060003_origins_trade_settle.sql creates and restores what it replaced (0001's open/settle/cancel, the one-of-each unique index, 0002's
-- 11-kind check). Valid only while no 'trade' or 'trade-cancel' event exists (events are append-only) and no account holds two copies of a single-copy piece.
drop trigger origins_one_of_each on public.origins_items;
drop function public.origins_one_of_each();
create unique index origins_items_one_of_each on public.origins_items (holder_account, item) where single_copy and retired_at is null and holder_account is not null;
drop function public.origins_cancel_trade(text, text, jsonb), public.origins_settle_trade(text, int, jsonb), public.origins_accept_trade(text, text, int, boolean),
  public.origins_change_offer(text, text, int, jsonb), public.origins_escrow_set(text);
drop trigger origins_escrow_guard on public.origins_items;
drop function public.origins_escrow_guard();
create or replace function public.origins_open_trade(p_container text, p_side_a text, p_side_b text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.origins_characters a, public.origins_characters b where a.id = p_side_a and b.id = p_side_b and public.origins_allowed(a.account) and public.origins_allowed(b.account)) then
    raise exception 'origins is not open for both sides' using errcode = 'O0007'; end if;
  insert into public.origins_trades (container, side_a, side_b) values (p_container, p_side_a, p_side_b);
end $$;
create function public.origins_settle_trade(p_container text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; out jsonb;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  if t.side_a is null or t.side_b is null then raise exception 'trade % lost a side: cancel it' , p_container using errcode = 'O0002'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  out := public.origins_apply(p_batch, accts);
  update public.origins_trades set state = 'settled', settled_at = now() where container = p_container;
  return out;
end $$;
create function public.origins_cancel_trade(p_container text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; out jsonb;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  out := public.origins_apply(p_batch, accts);   -- the escrowed items go back to their owners
  update public.origins_trades set state = 'cancelled', settled_at = now() where container = p_container;
  return out;
end $$;
revoke all on function public.origins_settle_trade(text, jsonb), public.origins_cancel_trade(text, jsonb) from public, anon, authenticated;
grant execute on function public.origins_settle_trade(text, jsonb), public.origins_cancel_trade(text, jsonb) to frankendom_origins;
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid'));
delete from public.origins_config where key = 'trade_hard_expiry_s';
drop index public.origins_trades_open_side_b, public.origins_trades_open_side_a;
alter table public.origins_trades
  drop constraint origins_trades_cancel_reason,
  drop column cancel_reason, drop column last_change_at, drop column expires_at, drop column region,
  drop column accepted_set_b, drop column accepted_set_a, drop column accepted_at_b, drop column accepted_at_a,
  drop column accepted_version_b, drop column accepted_version_a, drop column offer_version;
commit;
