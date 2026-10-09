-- The spawn key's zone had a ceiling: 202610090016 reads it with '^z([0-9]{1,3}):', so a key like `z1000:wolves-1` did not match and was stored as zone '1' (silently, not refused). Dom plans 700+ zones.
-- The rule becomes: `z<N>:` with N one or more digits and no leading zero, no ceiling; a key that does not match is Zone 1 as before (the writer, origins/server/world-spawns.ts zoneOfKey, REFUSES a key that
-- starts like a zone (`^z[0-9]`) but does not parse, so the fallback is only ever for a real Zone 1 id). A zone is its folder number (origins/zones/zone<N>/); nothing here lists zones, so a new zone needs no migration.
-- Written as drop index + drop column + add column + create index: a stored generated column's expression can only be replaced in place on PostgreSQL 17 (SET EXPRESSION), and the test clusters are older.
-- origins_spawns holds a handful of rows (4 in production when this was written); the rewrite is instant. ROLLBACK: supabase/down/202610090017_origins_spawn_zone_unbounded_down.sql (back to {1,3}).
begin;
drop index if exists public.origins_spawns_zone;
alter table public.origins_spawns drop column zone;
alter table public.origins_spawns
  add column zone text not null generated always as (coalesce(substring(instance from '^z([1-9][0-9]*):'), '1')) stored;
create index origins_spawns_zone on public.origins_spawns (zone, instance);
commit;
