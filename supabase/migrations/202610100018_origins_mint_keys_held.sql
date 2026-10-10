begin;
-- Class 1 (one read-only function, no table change): which of these LEGACY mint keys of THIS account exist in origins_items, whatever their state (live, retired, traded away).
-- gear_import asked origins_open's live view, but mint_key is unique across ALL rows and items are never deleted: a migrated piece later retired or traded was planned again,
-- hit the unique key, and every later import for the account failed with a 500 (Auditor, #1984). The writer has no table grants, so the read is a definer function like
-- origins_event. Only keys of the form legacy:<this account>:... answer (so keys cannot be probed across accounts), and an account that is not allowed reads empty.
-- Fail-safe on order: the writer asks to_regprocedure first (store.mintKeysHeld), so merged code on a database without this function still runs on the live view.
-- ROLLBACK: supabase/down/202610100018_origins_mint_keys_held_down.sql.
create function public.origins_mint_keys_held(p_account uuid, p_keys text[]) returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(i.mint_key order by i.mint_key), '{}'::text[])
  from public.origins_items i
  where public.origins_allowed(p_account) and i.mint_key = any (p_keys) and i.mint_key like 'legacy:' || p_account::text || ':%'
$$;
revoke all on function public.origins_mint_keys_held(uuid, text[]) from public, anon, authenticated;
grant execute on function public.origins_mint_keys_held(uuid, text[]) to frankendom_origins;
commit;
