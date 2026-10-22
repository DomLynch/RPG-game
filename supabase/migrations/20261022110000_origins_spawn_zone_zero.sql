-- ROLLBACK: supabase/down/20261022110000_origins_spawn_zone_zero_down.sql (back to 202610090017's rule: no zone 0).
-- CLASS 2, APPLY-READY only (Backend's review; Dom applies on prod): the generated column origins_spawns.zone is dropped and added again with a wider expression (and its index with it). No row, key, other
-- column, function or grant changes. origins_spawns holds a handful of rows, so the rewrite is instant (202610090017 did the same).
-- Why (Dom 2026-10-22: the town is ZONE 0): 202610090017 reads the spawn key's zone with '^z([1-9][0-9]*):', so a key `z0:...` did not match and was stored as zone '1' (silently, not refused), the one outcome a
-- key must never have. The rule becomes `z<N>:` with N = 0, or one or more digits with no leading zero; a key that does not match is Zone 1 as before. The writer (origins/server/world-spawns.ts zoneOfKey) already
-- REFUSES a key that starts like a zone (`^z[0-9]`) but does not parse (`z01:`), so the fallback is still only for a real Zone 1 id. The town is creature-free and has no spawn rows, so nothing is stored under
-- zone 0 today; this keeps the database and the writer agreeing about what zone 0 is the day it does.
-- Written as drop index + drop column + add column + create index: a stored generated column's expression can only be replaced in place on PostgreSQL 17 (SET EXPRESSION), and the test clusters are older.
begin;
drop index if exists public.origins_spawns_zone;
alter table public.origins_spawns drop column zone;
alter table public.origins_spawns
  add column zone text not null generated always as (coalesce(substring(instance from '^z(0|[1-9][0-9]*):'), '1')) stored;
create index origins_spawns_zone on public.origins_spawns (zone, instance);
commit;
