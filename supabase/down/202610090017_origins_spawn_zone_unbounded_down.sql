-- Rollback of 202610090017_origins_spawn_zone_unbounded.sql: the zone column back to 202610090016's expression (1 to 3 digits). A key with a 4+ digit zone would read as zone '1' again.
begin;
drop index if exists public.origins_spawns_zone;
alter table public.origins_spawns drop column zone;
alter table public.origins_spawns
  add column zone text not null generated always as (coalesce(substring(instance from '^z([0-9]{1,3}):'), '1')) stored;
create index origins_spawns_zone on public.origins_spawns (zone, instance);
commit;
