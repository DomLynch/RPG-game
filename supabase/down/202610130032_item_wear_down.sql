-- Drops exactly what supabase/migrations/202610130032_item_wear.sql creates.
begin;
drop function if exists public.origins_item_wear(uuid, text[]);
drop index if exists public.origins_events_wear;
commit;
