-- Drops exactly what supabase/migrations/20261015120000_origins_ground_takes.sql creates.
begin;
drop function if exists public.origins_ground_take(uuid, text, int, int, jsonb);
drop function if exists public.origins_ground_state(uuid, text[]);
drop table if exists public.origins_ground_takes;
commit;
