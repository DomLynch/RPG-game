begin;
-- ROLLBACK: supabase/down/20261018100000_origins_qa_no_loot_down.sql (restores the one function body this file replaces and drops the one function it creates).
-- CLASS 2, Origins-only, SMALL: ONE new read function and ONE replaced function BODY (origins_ground_take; create or replace keeps its grants, signature and result). No table, column, index or policy is touched.
-- Why (Strategy ruling via Lead, 2026-10-18; Auditor design): the QA account's world kills count for the strict-mode soak, but the account must never persist loot or currency. The account is already
-- MARKED: fighter_profiles.is_test (migration 202610110021: not null, client-unwritable, and leaderboards() / daily_board already skip it), so no second mark and no account ids in the repo.
-- (1) origins_account_is_test(account): the mark, read for the writer. STABLE, SECURITY DEFINER, false for an account with no profile row. EXECUTE to the two writer roles only: frankendom_origins and
--     frankendom_verifier (the writer's real login role, as every origins_* function; scripts/origins-writer-check.mjs enforces it).
-- (2) origins_ground_take: a QA account's take is the CLAIM and the event with NO mint, so the item is not persisted but the respawn window and the claim count behave exactly as for anyone. Nothing else
--     changes: every other check, the expected-n, the window, the allowlist of ops (event, mint) and the key rule are the previous body's. A non-QA account still needs exactly one mint under its own key.
--     A QA account may send zero mints (the writer's QA path) or one (the writer's lookup failed and it paid as normal: accepted, the pre-launch wipe covers the QA account).
--     plpgsql ON PURPOSE: fighter_profiles.is_test belongs to another series (202610110021), and a language-sql body is resolved against the catalog at CREATE, so scripts/origins-database-check.mjs (which
--     applies only the _origins_ follow-ups on a cluster without that series) could not create it. A plpgsql body is resolved when it runs; in production, and in every check that applies all migrations, the column exists.
create function public.origins_account_is_test(p_account uuid) returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce((select p.is_test from public.fighter_profiles p where p.user_id = p_account), false);
end $$;
revoke all on function public.origins_account_is_test(uuid) from public, anon, authenticated;
grant execute on function public.origins_account_is_test(uuid) to frankendom_origins, frankendom_verifier;

create or replace function public.origins_ground_take(p_account uuid, p_instance text, p_expected_n int, p_respawn_s int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_ground_takes; out jsonb; key text; window_end timestamptz; mints int;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  if p_instance !~ '^ground:[a-z0-9._-]{1,60}$' or p_expected_n < 1 or p_expected_n > 9999 or p_respawn_s < 1 then raise exception 'a ground take names a ground instance, a claim number and a respawn window' using errcode = 'O0002'; end if;
  key := 'loot:ground.' || substr(encode(sha256(convert_to(p_instance || '|' || p_account::text || '|' || p_expected_n::text, 'UTF8')), 'hex'), 1, 32) || ':0';
  if jsonb_typeof(p_batch) <> 'array' or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' is null or l ->> 'op' not in ('event', 'mint')) then
    raise exception 'a ground batch carries only event and mint ops' using errcode = 'O0002'; end if;
  select count(*) into mints from jsonb_array_elements(p_batch) l where l ->> 'op' = 'mint';
  if (mints <> 1 and not (mints = 0 and public.origins_account_is_test(p_account)))
     or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' = 'mint' and (l -> 'item' ->> 'mint_key') is distinct from key) then
    raise exception 'a ground take mints exactly one item, under its own key' using errcode = 'O0002'; end if;
  select * into t from public.origins_ground_takes where account = p_account and instance = p_instance for update;
  if found then
    if t.n + 1 <> p_expected_n then raise exception 'stale ground take: the claim moved' using errcode = 'O0002'; end if;
    window_end := t.taken_at + make_interval(secs => p_respawn_s);
    if window_end > now() then return jsonb_build_object('refused', 'taken', 'availableAt', window_end); end if;
    update public.origins_ground_takes set taken_at = now(), n = p_expected_n where account = p_account and instance = p_instance;
  else
    if p_expected_n <> 1 then raise exception 'stale ground take: the claim moved' using errcode = 'O0002'; end if;
    insert into public.origins_ground_takes (account, instance, n) values (p_account, p_instance, 1) on conflict do nothing;
    if not found then raise exception 'stale ground take: a concurrent take claimed it first' using errcode = 'O0002'; end if;
  end if;
  out := public.origins_apply(p_batch, array[p_account]);
  return jsonb_build_object('result', 'taken', 'instance', p_instance, 'n', p_expected_n, 'applied', out);
end $$;
commit;
