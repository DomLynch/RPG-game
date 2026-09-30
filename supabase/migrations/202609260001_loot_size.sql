begin;
-- Loot size cap 4 KB -> 64 KB (owner 2026-09-26: "keep it 64kb"; whales and end-game players are never stopped by it).
-- 0004's pg_column_size(loot) <= 4096 sat below what the client legitimately writes (the declined list alone, at the client's own cap
-- of 50, is ~4.9 KB; every piece plus 50 declines is ~15 KB), so every save from a well-played account failed the CHECK and the client
-- looped on "Save failed". The cap stays as an abuse backstop, not a play limit; the shape checks are unchanged.
-- Hosted: applied by the owner in the SQL editor with exactly these two statements (no MCP/DB URL in any session that night).
alter table public.fighter_profiles drop constraint fighter_profiles_loot_check;
alter table public.fighter_profiles add constraint fighter_profiles_loot_check
  check (jsonb_typeof(loot) = 'object' and jsonb_typeof(loot->'owned') = 'array' and jsonb_typeof(loot->'equipped') = 'object' and pg_column_size(loot) <= 65536);
commit;
