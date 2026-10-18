-- Undoes supabase/migrations/20261018100000_origins_qa_no_loot.sql: the previous origins_ground_take body back (exactly one mint for everyone), then the QA read function dropped.
begin;
create or replace function public.origins_ground_take(p_account uuid, p_instance text, p_expected_n int, p_respawn_s int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_ground_takes; out jsonb; key text; window_end timestamptz;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  if p_instance !~ '^ground:[a-z0-9._-]{1,60}$' or p_expected_n < 1 or p_expected_n > 9999 or p_respawn_s < 1 then raise exception 'a ground take names a ground instance, a claim number and a respawn window' using errcode = 'O0002'; end if;
  key := 'loot:ground.' || substr(encode(sha256(convert_to(p_instance || '|' || p_account::text || '|' || p_expected_n::text, 'UTF8')), 'hex'), 1, 32) || ':0';
  if jsonb_typeof(p_batch) <> 'array' or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' is null or l ->> 'op' not in ('event', 'mint')) then
    raise exception 'a ground batch carries only event and mint ops' using errcode = 'O0002'; end if;
  if (select count(*) from jsonb_array_elements(p_batch) l where l ->> 'op' = 'mint') <> 1
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
drop function if exists public.origins_account_is_test(uuid);
commit;
