-- Drops exactly what supabase/migrations/20261016170000_origins_active_name.sql creates.
begin;
drop function if exists public.origins_active_name(uuid);
commit;
