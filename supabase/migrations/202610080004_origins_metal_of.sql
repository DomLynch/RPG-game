begin;
-- ROLLBACK: supabase/down/202610080004_origins_metal_of_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE new read function. No table, existing function, grant or policy is altered.
-- Why: the `metal` op in origins_apply (202610070007) needs the balance row's expected_version for every award after the first, and the writer cannot read
-- origins_metal (no grant, by design, and origins_open does not return it). So a verified kill could never pay bronze twice. This is the read: the account's
-- bound-metal row as {bronze, version}, or null when it has none yet (the first award then inserts it). Read-only; the balance is still written only through
-- origins_apply, inside the settle's one transaction, where the version guard refuses a stale write (O0002).
create function public.origins_metal_of(p_account uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  return (select jsonb_build_object('bronze', m.bronze, 'version', m.version) from public.origins_metal m where m.account = p_account);
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation (the trap #1639 hit): revoke them, then grant the two writer roles only.
revoke all on function public.origins_metal_of(uuid) from public, anon, authenticated;
grant execute on function public.origins_metal_of(uuid) to frankendom_origins, frankendom_verifier;
commit;
