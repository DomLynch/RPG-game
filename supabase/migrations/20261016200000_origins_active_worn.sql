begin;
-- ROLLBACK: supabase/down/20261016200000_origins_active_worn_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE read function, no table, column, index, existing function, grant or policy is altered.
-- Why (other players in their own gear): presence tells a player what each other player WEARS, once per sighting and again when it changes (Web's dressing). The set is the ACTIVE
-- character's equipped rows, read server-side: this returns {item, tier, slot} per equipped, unretired piece. The writer maps item -> loot id with the same wornOf the sheet checks use.
-- Why not origins_open: that function locks the career row `for update` and returns the whole snapshot (every item, quest, journal line); presence refreshes this every 30 s per player, so it
-- must be a plain read that never waits on, or blocks, the player's own gear ops. STABLE, no lock. Same gate and shape as origins_active_name: [] when the account has no active character or
-- Origins is not open for it. Nothing else of the character leaves the database.
create function public.origins_active_worn(p_account uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', i.item, 'tier', i.tier, 'slot', i.loc_slot) order by i.loc_slot, i.id), '[]'::jsonb)
  from public.origins_active_character a join public.origins_items i on i.loc_owner = a.character
  where a.account = p_account and public.origins_allowed(p_account) and i.holder_account = p_account and i.retired_at is null and i.loc_kind = 'equipped' and i.loc_slot is not null
$$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation: revoke them, then grant the two writer roles only (as origins_active_name does).
revoke all on function public.origins_active_worn(uuid) from public, anon, authenticated;
grant execute on function public.origins_active_worn(uuid) to frankendom_origins, frankendom_verifier;
commit;
