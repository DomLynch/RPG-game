begin;
-- Loot (beta plan brief 5; owner via Strategy 2026-09-21: cosmetics only, no stats, one open locker, nothing lost). The fighter's owned
-- pieces and worn set travel with the cloud save like career marks: client-reported, bounded, validated on read by the client
-- (src/loot.ts cleanLoot: known ids only, worn pieces must be owned). Never rank, result or unlock authority for anything competitive.
alter table public.fighter_profiles add column loot jsonb not null default '{"owned":[],"equipped":{}}'::jsonb
  check (jsonb_typeof(loot) = 'object' and jsonb_typeof(loot->'owned') = 'array' and jsonb_typeof(loot->'equipped') = 'object' and pg_column_size(loot) <= 4096);
grant insert (loot) on public.fighter_profiles to authenticated;
grant update (loot) on public.fighter_profiles to authenticated;
commit;
