begin;
-- Drops exactly what 202610070005_origins_trade_limits.sql creates and restores 0001's purge. (The event-kind check is 0006's.)
drop function public.origins_trade_limits(uuid), public.origins_trade_counts(uuid, timestamptz),
  public.origins_trade_audit_prune(int), public.origins_trade_audit_record(text, uuid, text, text, text, text, text);
-- 0001's purge body again (the audit delete goes with the table).
create or replace function public.origins_purge_account(p_account uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare chars int; evs int; its int;
begin
  perform set_config('origins.purge', 'on', true);
  select count(*) into its from public.origins_items where holder_account = p_account and retired_at is null;
  delete from public.origins_events where account = p_account;
  get diagnostics evs = row_count;
  delete from public.origins_characters where account = p_account;
  get diagnostics chars = row_count;
  delete from public.origins_career where account = p_account;
  delete from public.origins_access where account = p_account;
  perform set_config('origins.purge', 'off', true);
  return jsonb_build_object('characters', chars, 'events', evs, 'live_items', its);
end $$;
drop table public.origins_trade_audit;
drop function public.origins_expire_trades();
drop trigger origins_trade_history on public.origins_items;
drop function public.origins_trade_history();
drop trigger origins_trade_cooldown_guard on public.origins_items;
drop function public.origins_trade_cooldown_guard();
drop function public.origins_trade_cooldown_s(int);
delete from public.origins_config where key in ('trade_cooldown', 'trade_idle_expiry_s', 'trade_gates', 'trade_caps');
commit;
