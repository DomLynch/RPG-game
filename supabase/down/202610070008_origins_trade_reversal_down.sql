begin;
-- Drops exactly what 202610070008_origins_trade_reversal.sql creates and restores 0003's 13-kind event check. Valid only while no 'trade-reversal', 'trade-hold' or
-- 'metal' event exists (events are append-only).
drop function public.origins_reverse_trade(text, uuid, text, jsonb);
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid', 'trade', 'trade-cancel'));
commit;
