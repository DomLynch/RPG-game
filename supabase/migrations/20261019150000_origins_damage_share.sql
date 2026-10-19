-- ROLLBACK: supabase/down/20261019150000_origins_damage_share_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: one new table (RLS on, no policy, no grant), three new definer functions granted to the two writer roles. No existing table, column, function, grant or policy is
-- altered; origins_spawn_kill (202610080014) stays as it is, so a writer that does not know this migration keeps working.
-- Why (Dom, 2026-10-19: kill credit "should be based on the damage contribution, that is fair, so no last shot kill steals"): the first valid report used to be the only winner; every other player
-- on the creature was answered 'dead' and paid nothing. Credit is now split by the damage each contributor's REPLAYED record shows (origins/server/damage-share.ts). This migration gives the writer:
--   origins_spawn_check(account, token, min_ms, join_s)   READ-ONLY: the same refusals the kill makes (dead, too-fast, caps) decided BEFORE any replay is queued (winner-first: a report the database
--                                                         would refuse never costs a replay), and whether this report is the 'first' kill of the creature or a 'join' to a kill made while this
--                                                         token was open. A join needs: the creature is dead at THIS token's generation, it died at or after the token was issued, it is still
--                                                         inside its respawn window, and at most join_s seconds have passed (the row worldShare.joinWindowS).
--   origins_spawn_damage_read(instance, generation)       the damage ledger of one incarnation of a creature (token, damage), so a later report knows what the earlier ones dealt.
--   origins_spawn_kill_v2(... , p_damage, p_join_s)       origins_spawn_kill with the join: a 'first' report kills the creature as before; a 'join' report pays its own (already share-scaled) batch
--                                                         without touching the spawn row; both write one origins_spawn_damage row in the same transaction.
-- Interim rule (Strategy/Lead 2026-10-19): a player whose verified damage alone reaches the creature's health is a solo kill at 100%, so two players who each killed their own copy each get the full reward
-- (each page plays its own copy until a shared server health bar, post-launch). The share arithmetic is the writer's; the database only checks, locks and writes.
begin;

create table public.origins_spawn_damage (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16,128}$'),
  instance text not null check (instance ~ '^[a-z0-9._:-]{1,96}$'),
  generation int not null check (generation >= 0),
  account uuid not null,
  damage numeric not null check (damage >= 0),
  joined boolean not null default false,
  at timestamptz not null default now()
);
create index origins_spawn_damage_incarnation on public.origins_spawn_damage (instance, generation);
alter table public.origins_spawn_damage enable row level security;
revoke all on public.origins_spawn_damage from public, anon, authenticated;

create function public.origins_spawn_check(p_account uuid, p_token text, p_min_ms int, p_join_s int) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; mode text;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now();
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where instance = e.instance;
  if s.alive and s.generation = e.generation then mode := 'first';
  elsif not s.alive and s.generation = e.generation and s.killed_at >= e.issued_at and s.respawn_at > now() and now() - s.killed_at <= make_interval(secs => greatest(p_join_s, 0)) then mode := 'join';
  else return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at); end if;
  if extract(epoch from (now() - e.issued_at)) * 1000 < greatest(p_min_ms, 0) then return jsonb_build_object('refused', 'too-fast'); end if;
  if (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 minute') >= cfg.kills_per_min
     or (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 hour') >= cfg.kills_per_hour then
    return jsonb_build_object('refused', 'cap');
  end if;
  return jsonb_build_object('ok', true, 'mode', mode, 'instance', e.instance, 'generation', e.generation);
end $$;

create function public.origins_spawn_damage_read(p_instance text, p_generation int) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token', d.token, 'damage', d.damage, 'joined', d.joined) order by d.at), '[]'::jsonb)
  from public.origins_spawn_damage d where d.instance = p_instance and d.generation = p_generation
$$;

create function public.origins_spawn_kill_v2(p_account uuid, p_token text, p_min_ms int, p_respawn_s int, p_batch jsonb, p_ledger jsonb, p_damage numeric, p_join_s int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; out jsonb; credit_before bigint; mode text;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  -- Only these ops ever ride a kill (as origins_spawn_kill): nothing outside the beta ledger can be paid through this path, whatever the writer sends.
  if jsonb_typeof(p_batch) <> 'array' or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' is null or l ->> 'op' not in ('event', 'mint', 'metal', 'career_set')) then
    raise exception 'a kill batch carries only event, mint, metal and career_set ops' using errcode = 'O0002'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now() for update;
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where instance = e.instance for update;
  if s.alive and s.generation = e.generation then mode := 'first';
  elsif not s.alive and s.generation = e.generation and s.killed_at >= e.issued_at and s.respawn_at > now() and now() - s.killed_at <= make_interval(secs => greatest(p_join_s, 0)) then mode := 'join';
  else
    update public.origins_spawn_engages set used_at = now(), result = 'dead' where token = p_token;
    return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at);
  end if;
  if extract(epoch from (now() - e.issued_at)) * 1000 < greatest(p_min_ms, 0) then return jsonb_build_object('refused', 'too-fast'); end if;
  if (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 minute') >= cfg.kills_per_min
     or (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 hour') >= cfg.kills_per_hour then
    return jsonb_build_object('refused', 'cap');
  end if;
  update public.origins_spawn_engages set used_at = now(), result = 'killed' where token = p_token;
  if mode = 'first' then
    update public.origins_spawns set alive = false, generation = e.generation, respawn_at = now() + make_interval(secs => least(greatest(p_respawn_s, 10), 86400)), killed_by = p_account, killed_at = now()
      where instance = e.instance returning * into s;
  end if;
  credit_before := coalesce((select world_credit from public.origins_career where account = p_account), 0);
  out := public.origins_apply(p_batch, array[p_account]);
  if p_ledger ->> 'reach' not in ('checked', 'unchecked') then raise exception 'ledger reach must be checked or unchecked' using errcode = 'O0002'; end if;
  insert into public.origins_beta_ledger (event_id, account, character, instance, item_ids, cp, bronze, reach_status)
    values ('enc:' || p_token, p_account, e.character, e.instance,
      coalesce((select array_agg(l -> 'item' ->> 'id') from jsonb_array_elements(p_batch) l where l ->> 'op' = 'mint'), '{}'),
      coalesce((select world_credit from public.origins_career where account = p_account), 0) - credit_before,
      coalesce((select sum((l ->> 'delta_bronze')::bigint) from jsonb_array_elements(p_batch) l where l ->> 'op' = 'metal'), 0),
      p_ledger ->> 'reach');
  insert into public.origins_spawn_damage (token, instance, generation, account, damage, joined) values (p_token, e.instance, e.generation, p_account, greatest(coalesce(p_damage, 0), 0), mode = 'join');
  return jsonb_build_object('result', 'killed', 'instance', s.instance, 'respawnAt', s.respawn_at, 'joined', mode = 'join', 'applied', out);
end $$;

revoke all on function public.origins_spawn_check(uuid, text, int, int), public.origins_spawn_damage_read(text, int), public.origins_spawn_kill_v2(uuid, text, int, int, jsonb, jsonb, numeric, int) from public, anon, authenticated;
grant execute on function public.origins_spawn_check(uuid, text, int, int), public.origins_spawn_damage_read(text, int), public.origins_spawn_kill_v2(uuid, text, int, int, jsonb, jsonb, numeric, int) to frankendom_origins, frankendom_verifier;
commit;
