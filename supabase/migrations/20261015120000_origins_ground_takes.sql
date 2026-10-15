begin;
-- ROLLBACK: supabase/down/20261015120000_origins_ground_takes_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE new table and TWO new functions. No existing table, column, constraint, function, grant or policy is altered; no existing row is read, rewritten or
-- deleted; origins_apply is untouched (it is CALLED, as origins_spawn_kill calls it). Ground loot (docs/specs/backend/ground-loot-brief.md, #2775; Lead + Strategy GO 2026-10-15).
-- What it is: a ground item (origins/world/ground-items.json) is taken ONCE per account per respawn window. The take is a CLAIM row, (account, instance) -> (taken_at, n), and the claim, the mint and the
-- event commit in ONE transaction (origins_ground_take), so two taps cannot both win and a retried request after a lost response mints nothing twice (the mint key is a digest of instance|account|n).
-- The writer reads the claim first (origins_ground_state), prices the take, and passes the n it expects: a take whose n is not the next one is refused as stale and writes nothing.
create table public.origins_ground_takes (
  account uuid not null,
  instance text not null check (instance ~ '^ground:[a-z0-9._-]{1,60}$'),
  taken_at timestamptz not null default now(),
  n int not null check (n >= 1 and n <= 9999),
  primary key (account, instance)
);
alter table public.origins_ground_takes enable row level security;
revoke all on public.origins_ground_takes from public, anon, authenticated;   -- no policy, no grant: only the definer functions below touch it

-- The claims of one account for the given ground instances (the writer's read before it prices a take). now() is the database's clock, returned so the writer never compares against its own.
create function public.origins_ground_state(p_account uuid, p_instances text[]) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  return jsonb_build_object('now', now(), 'takes', coalesce((select jsonb_agg(jsonb_build_object('instance', t.instance, 'n', t.n, 'takenAt', t.taken_at) order by t.instance)
    from public.origins_ground_takes t where t.account = p_account and t.instance = any (p_instances)), '[]'::jsonb));
end $$;

-- The take: claim, mint and event in one transaction. p_batch carries only event and mint ops, exactly ONE mint, under the key this function derives itself (so a rogue writer cannot reuse a key);
-- p_expected_n is the claim count + 1 the writer read; p_respawn_s is the instance row's respawn window, read by the writer from the shipped rows.
create function public.origins_ground_take(p_account uuid, p_instance text, p_expected_n int, p_respawn_s int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
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

-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation: revoke them, then grant the two writer roles only.
revoke all on function public.origins_ground_state(uuid, text[]), public.origins_ground_take(uuid, text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.origins_ground_state(uuid, text[]), public.origins_ground_take(uuid, text, int, int, jsonb) to frankendom_origins, frankendom_verifier;
commit;
