-- ROLLBACK of 20261019170000_origins_spawn_layers.sql: deletes the spawn rows and damage rows of layers above 1 (they are only "dead until T" clocks and a damage ledger of incarnations that no longer exist),
-- drops the layer column, restores the single-column key and the pre-layer function bodies. Engage rows and the beta ledger are never deleted, so every receipt stays readable; the foreign key from
-- engages to spawns comes back NOT VALID (engages of layers above 1 name an instance whose row they do not own), which skips the existing rows and checks every new one.
-- Run this BEFORE supabase/down/20261019113226_origins_damage_share_down.sql if both are rolled back (this file restores the bodies that migration created).
begin;

delete from public.origins_spawns where layer > 1;
delete from public.origins_spawn_damage where layer > 1;

drop function public.origins_spawn_layers_sweep(int[]);
drop function public.origins_spawn_damage_read_layer(int, text, int);
drop function public.origins_spawn_check_layer(uuid, text, int, int, int);
drop function public.origins_spawn_engage_layer(int, uuid, text, text, text, text);
drop function public.origins_spawn_state_layer(int, text[]);
drop index public.origins_spawn_engages_cooldown;

-- the pre-layer bodies (202610080014 and 20261019113226), restored before the key changes back
create or replace function public.origins_spawn_state(p_instances text[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('now', now(), 'spawns', coalesce((select jsonb_agg(public.origins_spawn_view(s) order by s.instance) from public.origins_spawns s where s.instance = any(p_instances)), '[]'::jsonb))
$$;

alter table public.origins_spawns drop constraint origins_spawns_pkey;
alter table public.origins_spawns add primary key (instance);
alter table public.origins_spawn_engages add constraint origins_spawn_engages_instance_fkey foreign key (instance) references public.origins_spawns (instance) not valid;
drop index public.origins_spawn_damage_incarnation;
create index origins_spawn_damage_incarnation on public.origins_spawn_damage (instance, generation);
alter table public.origins_spawn_damage drop column layer;
alter table public.origins_spawn_engages drop column layer;
alter table public.origins_spawns drop column layer;

create or replace function public.origins_spawn_engage(p_account uuid, p_character text, p_token text, p_instance text, p_kind text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; s public.origins_spawns; e public.origins_spawn_engages;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then raise exception 'origins is not open for this character' using errcode = 'O0007'; end if;
  select * into cfg from public.origins_world_config;
  insert into public.origins_spawns (instance, kind) values (p_instance, p_kind) on conflict (instance) do nothing;
  select * into s from public.origins_spawns where instance = p_instance for update;
  if s.kind <> p_kind then raise exception 'spawn % is a %, not a %', p_instance, s.kind, p_kind using errcode = 'O0002'; end if;
  if not s.alive and s.respawn_at > now() then return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at); end if;
  if not s.alive then update public.origins_spawns set alive = true, generation = generation + 1, respawn_at = null, killed_by = null, killed_at = null where instance = p_instance returning * into s; end if;
  -- an engage that ran out, or names a generation that has since died, is closed here so it never counts as open
  update public.origins_spawn_engages set used_at = now(), result = 'dead' where account = p_account and used_at is null and expires_at <= now();
  select * into e from public.origins_spawn_engages where account = p_account and instance = p_instance and used_at is null;
  if found and e.generation = s.generation then
    update public.origins_spawn_engages set touched_at = now(), expires_at = now() + make_interval(secs => cfg.engage_ttl_s) where token = e.token returning * into e;
  else
    if found then update public.origins_spawn_engages set used_at = now(), result = 'dead' where token = e.token; end if;
    if (select count(*) from public.origins_spawn_engages where account = p_account and used_at is null) >= cfg.max_open then return jsonb_build_object('refused', 'too-many'); end if;
    insert into public.origins_spawn_engages (token, account, character, instance, generation, expires_at)
      values (p_token, p_account, p_character, p_instance, s.generation, now() + make_interval(secs => cfg.engage_ttl_s)) returning * into e;
  end if;
  return jsonb_build_object('token', e.token, 'instance', e.instance, 'generation', e.generation, 'kind', s.kind, 'issuedAt', e.issued_at, 'expiresAt', e.expires_at);
end $$;

create or replace function public.origins_spawn_engage_get(p_account uuid, p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('token', e.token, 'character', e.character, 'instance', e.instance, 'generation', e.generation, 'issuedAt', e.issued_at, 'expiresAt', e.expires_at)
  from public.origins_spawn_engages e where e.token = p_token and e.account = p_account and e.used_at is null and e.expires_at > now()
$$;

create or replace function public.origins_spawn_kill(p_account uuid, p_token text, p_min_ms int, p_respawn_s int, p_batch jsonb, p_ledger jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; out jsonb; credit_before bigint;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  -- Only these ops ever ride a kill (Auditor PRE, condition 1): nothing outside the beta ledger can be paid through this path, whatever the writer sends.
  if jsonb_typeof(p_batch) <> 'array' or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' is null or l ->> 'op' not in ('event', 'mint', 'metal', 'career_set')) then
    raise exception 'a kill batch carries only event, mint, metal and career_set ops' using errcode = 'O0002'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now() for update;
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where instance = e.instance for update;
  if not (s.alive and s.generation = e.generation) then   -- killed by someone else first (or it died and came back as a later generation)
    update public.origins_spawn_engages set used_at = now(), result = 'dead' where token = p_token;
    return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at);
  end if;
  if extract(epoch from (now() - e.issued_at)) * 1000 < greatest(p_min_ms, 0) then return jsonb_build_object('refused', 'too-fast'); end if;
  if (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 minute') >= cfg.kills_per_min
     or (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 hour') >= cfg.kills_per_hour then
    return jsonb_build_object('refused', 'cap');
  end if;
  update public.origins_spawn_engages set used_at = now(), result = 'killed' where token = p_token;
  update public.origins_spawns set alive = false, generation = e.generation, respawn_at = now() + make_interval(secs => least(greatest(p_respawn_s, 10), 86400)), killed_by = p_account, killed_at = now()
    where instance = e.instance returning * into s;
  credit_before := coalesce((select world_credit from public.origins_career where account = p_account), 0);
  out := public.origins_apply(p_batch, array[p_account]);
  if p_ledger ->> 'reach' not in ('checked', 'unchecked') then raise exception 'ledger reach must be checked or unchecked' using errcode = 'O0002'; end if;
  insert into public.origins_beta_ledger (event_id, account, character, instance, item_ids, cp, bronze, reach_status)
    values ('enc:' || p_token, p_account, e.character, e.instance,
      coalesce((select array_agg(l -> 'item' ->> 'id') from jsonb_array_elements(p_batch) l where l ->> 'op' = 'mint'), '{}'),
      coalesce((select world_credit from public.origins_career where account = p_account), 0) - credit_before,   -- the CP this kill actually booked (Auditor condition 2): read, never taken from the writer
      coalesce((select sum((l ->> 'delta_bronze')::bigint) from jsonb_array_elements(p_batch) l where l ->> 'op' = 'metal'), 0),
      p_ledger ->> 'reach');
  return jsonb_build_object('result', 'killed', 'instance', s.instance, 'respawnAt', s.respawn_at, 'applied', out);
end $$;

create or replace function public.origins_spawn_check(p_account uuid, p_token text, p_min_ms int, p_join_s int) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; mode text;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now();
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where instance = e.instance;
  if s.alive and s.generation = e.generation then mode := 'first';
  elsif not s.alive and s.generation = e.generation and s.killed_by is distinct from p_account and s.killed_at >= e.issued_at and s.respawn_at > now() and now() - s.killed_at <= make_interval(secs => greatest(p_join_s, 0)) then mode := 'join';
  else return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at); end if;
  if extract(epoch from (now() - e.issued_at)) * 1000 < greatest(p_min_ms, 0) then return jsonb_build_object('refused', 'too-fast'); end if;
  if (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 minute') >= cfg.kills_per_min
     or (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 hour') >= cfg.kills_per_hour then
    return jsonb_build_object('refused', 'cap');
  end if;
  return jsonb_build_object('ok', true, 'mode', mode, 'instance', e.instance, 'generation', e.generation);
end $$;

create or replace function public.origins_spawn_damage_read(p_instance text, p_generation int) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token', d.token, 'damage', d.damage, 'joined', d.joined) order by d.at), '[]'::jsonb)
  from public.origins_spawn_damage d where d.instance = p_instance and d.generation = p_generation
$$;

create or replace function public.origins_spawn_kill_v2(p_account uuid, p_token text, p_min_ms int, p_respawn_s int, p_batch jsonb, p_ledger jsonb, p_damage numeric, p_join_s int) returns jsonb language plpgsql security definer set search_path = '' as $$
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
  elsif not s.alive and s.generation = e.generation and s.killed_by is distinct from p_account and s.killed_at >= e.issued_at and s.respawn_at > now() and now() - s.killed_at <= make_interval(secs => greatest(p_join_s, 0)) then mode := 'join';
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
commit;
