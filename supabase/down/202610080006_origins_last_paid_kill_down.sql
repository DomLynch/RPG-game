begin;
-- Undo 202610080006_origins_last_paid_kill.sql: exactly the function and the index it created. The `fight` / `paid` payload keys stay in the events (harmless data).
drop function if exists public.origins_last_paid_kill(uuid, text);
drop index if exists public.origins_events_paid_mob;
commit;
