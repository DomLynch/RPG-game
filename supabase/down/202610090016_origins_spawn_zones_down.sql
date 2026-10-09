-- Rollback of 202610090016_origins_spawn_zones.sql: drops exactly the generated column and its index; no row, function or grant is touched.
begin;
drop index if exists public.origins_spawns_zone;
alter table public.origins_spawns drop column if exists zone;
commit;
