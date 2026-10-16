begin;
-- ROLLBACK: supabase/down/20261016170000_origins_active_name_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE read function, no table, column, index, existing function, grant or policy is altered.
-- Why (presence name tags): presence tells a player the display name of each other player who comes within sight, once, so Web can draw a name tag. Presence holds no names; the name is
-- origins_characters.name (1..32 chars, already past the name filter at creation). The writer already asks "where does this account start" at join (GET /internal/location) and
-- reads the ACTIVE character for it; this returns that character's name beside it. Same gate and shape as origins_active (migration 202610070009): the account's active character,
-- null when the account has none or origins is not open for it. Nothing else of the character leaves the database.
create function public.origins_active_name(p_account uuid) returns text language sql stable security definer set search_path = '' as $$
  select c.name from public.origins_active_character a join public.origins_characters c on c.id = a.character and c.account = a.account
  where a.account = p_account and public.origins_allowed(p_account)
$$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation: revoke them, then grant the two writer roles only (as migration 20261013174936 does).
revoke all on function public.origins_active_name(uuid) from public, anon, authenticated;
grant execute on function public.origins_active_name(uuid) to frankendom_origins, frankendom_verifier;
commit;
