-- CLASS 1, ADDITIVE and Origins-only: one GENERATED column + one index on origins_spawns. No function, grant, policy or existing value is altered (the column is derived from
-- `instance`, so every existing row reads zone '1' and nothing is written). ROLLBACK: supabase/down/202610090016_origins_spawn_zones_down.sql (drops exactly the column and index).
-- Why (Lead, Proof 2 support, 2026-10-09: Zone 2 "Ash Reach", World #1945): migration 202610080014 creates a spawn row on its FIRST engage, keyed by the page's own instance id
-- (mobSpecs: `<spawn point>-<n>`, openers `opener-<zone>-1`), with no zone. So Zone 2 needs no seeded rows (its six placeholder kinds are created on first engage, exactly like Zone 1),
-- but it needs ids that cannot collide: a Region 2 spawn point reusing a Zone 1 name (`wolves`) would share Zone 1's row, and a Zone 2 kill would mark Zone 1's wolf dead.
-- The rule (EverQuest's spawn2 keys every spawn point by its zone): Zone 1 ids stay as they are (live rows, nothing renamed); Zone N >= 2 ids are `z<N>:<spawn point>-<n>`
-- (e.g. `z2:wolves-1`, `z2:opener-ash-reach-1`; 0014's instance check already allows ':'). This column makes the zone a fact the database can read and index (spawn_state per zone,
-- ops counts, a per-zone reset) without any function change. The writer's spawn list (origins/server/world-spawns.ts zone1Spawns) is Zone 1 only until World's slice 2.
begin;

alter table public.origins_spawns
  add column zone text not null generated always as (coalesce(substring(instance from '^z([0-9]{1,3}):'), '1')) stored;
create index origins_spawns_zone on public.origins_spawns (zone, instance);

commit;
