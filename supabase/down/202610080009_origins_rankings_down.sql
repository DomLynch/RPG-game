begin;
-- Undo 202610080009_origins_rankings.sql: exactly the function and the index it created; no data is touched.
drop function if exists public.origins_rankings(text, int);
drop index if exists public.origins_events_won_mob;
commit;
