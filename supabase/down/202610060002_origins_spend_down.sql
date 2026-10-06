begin;
-- Drops exactly what 202610060002_origins_spend.sql creates and restores the kind check it replaced. Valid only while no 'burn' or 'upgrade' event exists
-- (origins_events is append-only): the check re-adds as the original list and the ALTER fails, loudly, if one does. The flag is OFF until the writer ships its ops.
drop function public.origins_event(uuid, text);
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint'));
commit;
