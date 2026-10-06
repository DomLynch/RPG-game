begin;
-- Drops exactly what 202610070005_origins_trade_limits.sql creates and restores 0003's 13-kind event check. Valid only while no 'trade-reversal', 'trade-hold' or
-- 'metal' event exists (events are append-only).
drop function public.origins_expire_trades();
drop trigger origins_trade_history on public.origins_items;
drop function public.origins_trade_history();
drop trigger origins_trade_cooldown_guard on public.origins_items;
drop function public.origins_trade_cooldown_guard();
drop function public.origins_trade_cooldown_s(int);
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid', 'trade', 'trade-cancel'));
delete from public.origins_config where key in ('trade_cooldown', 'trade_idle_expiry_s');
commit;
