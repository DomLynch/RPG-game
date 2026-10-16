-- Drops exactly what supabase/migrations/20261016161137_origins_active_name.sql creates.
begin;
drop function if exists public.origins_active_name(uuid);
commit;
