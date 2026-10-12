begin;
-- Undoes 202610120023_live_ops.sql. Nothing depends on these objects; the writer falls back to its defaults (no events, every switch on).
drop function if exists public.origins_live_ops();
drop table if exists public.origins_switches;
drop table if exists public.origins_live_events;
commit;
