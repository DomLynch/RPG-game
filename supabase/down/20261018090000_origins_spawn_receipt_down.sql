-- Drops exactly what supabase/migrations/20261018090000_origins_spawn_receipt.sql creates.
begin;
drop function if exists public.origins_spawn_receipt(uuid, text);
commit;
