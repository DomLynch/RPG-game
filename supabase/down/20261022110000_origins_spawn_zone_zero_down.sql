-- Rollback of 20261022110000_origins_spawn_zone_zero.sql: the zone column back to 202610090017's expression (no zone 0). A key `z0:...` would read as zone '1' again.
begin;
drop index if exists public.origins_spawns_zone;
alter table public.origins_spawns drop column zone;
alter table public.origins_spawns
  add column zone text not null generated always as (coalesce(substring(instance from '^z([1-9][0-9]*):'), '1')) stored;
create index origins_spawns_zone on public.origins_spawns (zone, instance);
commit;
