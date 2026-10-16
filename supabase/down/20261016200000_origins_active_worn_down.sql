-- Drops exactly what supabase/migrations/20261016200000_origins_active_worn.sql creates.
begin;
drop function if exists public.origins_active_worn(uuid);
commit;
