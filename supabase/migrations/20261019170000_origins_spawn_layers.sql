-- ROLLBACK: supabase/down/20261019170000_origins_spawn_layers_down.sql (deletes layers > 1, then restores the single-column key and the old function bodies).
-- CLASS 2, NOT purely additive (Origins-only): origins_spawns' primary key changes from (instance) to (layer, instance), origins_spawn_engages loses its foreign key to origins_spawns, three tables gain a
-- `layer` column (default 1), and five existing definer functions are REPLACED (same signatures, same grants): origins_spawn_state and origins_spawn_engage become thin layer-1 delegates; origins_spawn_engage_get,
-- origins_spawn_kill, origins_spawn_check, origins_spawn_kill_v2 and origins_spawn_damage_read read the token's layer. Needs the Auditor's apply-ready review and a rehearsal on a copy of prod data
-- (scripts/origins-spawns-check.mjs and scripts/origins-damage-share-check.mjs carry the layer cases).
-- Why (Dom 2026-10-19, docs/specs/origins/per-layer-spawns.md section 2 and 3): presence opens a second, third... copy ("layer") of the world as the crowd grows, and every copy needs its OWN spawn clocks, so a
-- crowd of 1,000 does not share one pool of 24 Zone 1 spawns. The layer is a COLUMN, never part of the creature id (ids like `wolves-1` stay as they are), so a recorded kill's binding to its spawn id and the replay
-- verifier are untouched. Every existing row becomes layer 1 (presence's first layer, where today's players already are); a new layer needs no setup: no row means every spawn alive, generation 0 (rows are made on
-- the first engage, as before).
-- Expand/contract: the NEW layer-taking functions are origins_spawn_state_layer, origins_spawn_engage_layer, origins_spawn_check_layer, origins_spawn_damage_read_layer and origins_spawn_layers_sweep. The old
-- names keep working for a writer that does not know this migration: they act on layer 1 (state, engage) or on the token's own layer (the rest), so the writer and the database can deploy in either order.
-- A later migration drops the layer-less names once the writer has used the new ones for a release.
-- New rule inside the kill (design note 3b): ONE PAID KILL PER ACCOUNT PER SPAWN ID PER RESPAWN WINDOW ACROSS LAYERS. A report is refused `cooldown` (writes nothing) when the account already has a 'killed' engage on the
-- same instance in ANOTHER layer within p_respawn_s of now. Inside one layer nothing changes (the spawn is dead for everyone, as before). The window counts from the engage's used_at, so a join (which reports up to the
-- join window after the kill) holds it a little longer: conservative, never looser. Layer-hopping to re-kill a creature therefore gains nothing; the per-account caps (kills per minute / hour) still bind minting.
begin;

alter table public.origins_spawns add column layer int not null default 1 check (layer >= 1);
alter table public.origins_spawn_engages drop constraint origins_spawn_engages_instance_fkey;
alter table public.origins_spawns drop constraint origins_spawns_pkey;
alter table public.origins_spawns add primary key (layer, instance);
alter table public.origins_spawn_engages add column layer int not null default 1 check (layer >= 1);
alter table public.origins_spawn_damage add column layer int not null default 1 check (layer >= 1);
drop index public.origins_spawn_damage_incarnation;
create index origins_spawn_damage_incarnation on public.origins_spawn_damage (layer, instance, generation);
create index origins_spawn_engages_cooldown on public.origins_spawn_engages (account, instance, used_at desc) where result = 'killed';

-- Read-only: the server's state of the named instances in ONE layer (never-engaged ones are not listed: the writer reads them as alive, generation 0) and the database clock.
create function public.origins_spawn_state_layer(p_layer int, p_instances text[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('now', now(), 'spawns', coalesce((select jsonb_agg(public.origins_spawn_view(s) order by s.instance) from public.origins_spawns s where s.layer = p_layer and s.instance = any(p_instances)), '[]'::jsonb))
$$;

-- Engage a LIVE spawn of one layer. As origins_spawn_engage (202610080014) with the layer in the key. An open engage this account holds on the same instance in ANOTHER layer is closed ('dead') here, so a player who
-- moved layers never carries a token across copies.
create function public.origins_spawn_engage_layer(p_layer int, p_account uuid, p_character text, p_token text, p_instance text, p_kind text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; s public.origins_spawns; e public.origins_spawn_engages;
begin
  if p_layer is null or p_layer < 1 then raise exception 'layer must be a positive number' using errcode = 'O0002'; end if;
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then raise exception 'origins is not open for this character' using errcode = 'O0007'; end if;
  select * into cfg from public.origins_world_config;
  insert into public.origins_spawns (layer, instance, kind) values (p_layer, p_instance, p_kind) on conflict (layer, instance) do nothing;
  select * into s from public.origins_spawns where layer = p_layer and instance = p_instance for update;
  if s.kind <> p_kind then raise exception 'spawn % is a %, not a %', p_instance, s.kind, p_kind using errcode = 'O0002'; end if;
  if not s.alive and s.respawn_at > now() then return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at); end if;
  if not s.alive then update public.origins_spawns set alive = true, generation = generation + 1, respawn_at = null, killed_by = null, killed_at = null where layer = p_layer and instance = p_instance returning * into s; end if;
  update public.origins_spawn_engages set used_at = now(), result = 'dead' where account = p_account and used_at is null and expires_at <= now();
  update public.origins_spawn_engages set used_at = now(), result = 'dead' where account = p_account and instance = p_instance and used_at is null and layer <> p_layer;
  select * into e from public.origins_spawn_engages where account = p_account and instance = p_instance and layer = p_layer and used_at is null;
  if found and e.generation = s.generation then
    update public.origins_spawn_engages set touched_at = now(), expires_at = now() + make_interval(secs => cfg.engage_ttl_s) where token = e.token returning * into e;
  else
    if found then update public.origins_spawn_engages set used_at = now(), result = 'dead' where token = e.token; end if;
    if (select count(*) from public.origins_spawn_engages where account = p_account and used_at is null) >= cfg.max_open then return jsonb_build_object('refused', 'too-many'); end if;
    insert into public.origins_spawn_engages (token, account, character, instance, layer, generation, expires_at)
      values (p_token, p_account, p_character, p_instance, p_layer, s.generation, now() + make_interval(secs => cfg.engage_ttl_s)) returning * into e;
  end if;
  return jsonb_build_object('token', e.token, 'instance', e.instance, 'layer', e.layer, 'generation', e.generation, 'kind', s.kind, 'issuedAt', e.issued_at, 'expiresAt', e.expires_at);
end $$;

-- The old names, now layer-1 delegates (a writer that does not know layers keeps today's single pool).
create or replace function public.origins_spawn_state(p_instances text[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select public.origins_spawn_state_layer(1, p_instances)
$$;
create or replace function public.origins_spawn_engage(p_account uuid, p_character text, p_token text, p_instance text, p_kind text) returns jsonb language sql security definer set search_path = '' as $$
  select public.origins_spawn_engage_layer(1, p_account, p_character, p_token, p_instance, p_kind)
$$;

-- One OPEN engage of this account (null when unknown, used or expired): now with the token's layer.
create or replace function public.origins_spawn_engage_get(p_account uuid, p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('token', e.token, 'character', e.character, 'instance', e.instance, 'layer', e.layer, 'generation', e.generation, 'issuedAt', e.issued_at, 'expiresAt', e.expires_at)
  from public.origins_spawn_engages e where e.token = p_token and e.account = p_account and e.used_at is null and e.expires_at > now()
$$;

-- The kill report, as 202610080014, on the TOKEN's layer, plus the cross-layer cooldown.
create or replace function public.origins_spawn_kill(p_account uuid, p_token text, p_min_ms int, p_respawn_s int, p_batch jsonb, p_ledger jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; out jsonb; credit_before bigint;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  if jsonb_typeof(p_batch) <> 'array' or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' is null or l ->> 'op' not in ('event', 'mint', 'metal', 'career_set')) then
    raise exception 'a kill batch carries only event, mint, metal and career_set ops' using errcode = 'O0002'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now() for update;
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where layer = e.layer and instance = e.instance for update;
  -- `not found`: the foreign key is gone, so the spawn row can be missing (the janitor deleted a closed layer's rows); without this the NULL comparison below would skip the refusal and pay a kill of nothing (Auditor, #3315)
  if not found or not (s.alive and s.generation = e.generation) then
    update public.origins_spawn_engages set used_at = now(), result = 'dead' where token = p_token;
    return jsonb_build_object('refused', 'dead', 'respawnAt', s.respawn_at);
  end if;
  if extract(epoch from (now() - e.issued_at)) * 1000 < greatest(p_min_ms, 0) then return jsonb_build_object('refused', 'too-fast'); end if;
  if (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 minute') >= cfg.kills_per_min
     or (select count(*) from public.origins_spawn_engages where account = p_account and result = 'killed' and used_at > now() - interval '1 hour') >= cfg.kills_per_hour then
    return jsonb_build_object('refused', 'cap');
  end if;
  if exists (select 1 from public.origins_spawn_engages x where x.account = p_account and x.instance = e.instance and x.layer <> e.layer and x.result = 'killed' and x.used_at > now() - make_interval(secs => least(greatest(p_respawn_s, 10), 86400))) then
    return jsonb_build_object('refused', 'cooldown');
  end if;
  update public.origins_spawn_engages set used_at = now(), result = 'killed' where token = p_token;
  update public.origins_spawns set alive = false, generation = e.generation, respawn_at = now() + make_interval(secs => least(greatest(p_respawn_s, 10), 86400)), killed_by = p_account, killed_at = now()
    where layer = e.layer and instance = e.instance returning * into s;
  credit_before := coalesce((select world_credit from public.origins_career where account = p_account), 0);
  out := public.origins_apply(p_batch, array[p_account]);
  if p_ledger ->> 'reach' not in ('checked', 'unchecked') then raise exception 'ledger reach must be checked or unchecked' using errcode = 'O0002'; end if;
  insert into public.origins_beta_ledger (event_id, account, character, instance, item_ids, cp, bronze, reach_status)
    values ('enc:' || p_token, p_account, e.character, e.instance,
      coalesce((select array_agg(l -> 'item' ->> 'id') from jsonb_array_elements(p_batch) l where l ->> 'op' = 'mint'), '{}'),
      coalesce((select world_credit from public.origins_career where account = p_account), 0) - credit_before,
      coalesce((select sum((l ->> 'delta_bronze')::bigint) from jsonb_array_elements(p_batch) l where l ->> 'op' = 'metal'), 0),
      p_ledger ->> 'reach');
  return jsonb_build_object('result', 'killed', 'instance', s.instance, 'respawnAt', s.respawn_at, 'applied', out);
end $$;

-- origins_spawn_check (20261019113226) on the token's layer. The old name carries no respawn window, so it cannot see the cooldown; origins_spawn_check_layer below takes it.
create or replace function public.origins_spawn_check(p_account uuid, p_token text, p_min_ms int, p_join_s int) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; mode text;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now();
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where layer = e.layer and instance = e.instance;
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

create function public.origins_spawn_check_layer(p_account uuid, p_token text, p_min_ms int, p_join_s int, p_respawn_s int) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare e public.origins_spawn_engages; out jsonb;
begin
  out := public.origins_spawn_check(p_account, p_token, p_min_ms, p_join_s);
  if out ->> 'refused' is not null then return out; end if;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now();
  if exists (select 1 from public.origins_spawn_engages x where x.account = p_account and x.instance = e.instance and x.layer <> e.layer and x.result = 'killed' and x.used_at > now() - make_interval(secs => least(greatest(p_respawn_s, 10), 86400))) then
    return jsonb_build_object('refused', 'cooldown');
  end if;
  return out || jsonb_build_object('layer', e.layer);
end $$;

-- The damage ledger of one incarnation of a creature IN ONE LAYER: generations count up per layer, so (instance, generation) alone would mix two layers' fights.
create function public.origins_spawn_damage_read_layer(p_layer int, p_instance text, p_generation int) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('token', d.token, 'damage', d.damage, 'joined', d.joined) order by d.at), '[]'::jsonb)
  from public.origins_spawn_damage d where d.layer = p_layer and d.instance = p_instance and d.generation = p_generation
$$;
create or replace function public.origins_spawn_damage_read(p_instance text, p_generation int) returns jsonb language sql stable security definer set search_path = '' as $$
  select public.origins_spawn_damage_read_layer(1, p_instance, p_generation)
$$;

create or replace function public.origins_spawn_kill_v2(p_account uuid, p_token text, p_min_ms int, p_respawn_s int, p_batch jsonb, p_ledger jsonb, p_damage numeric, p_join_s int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; out jsonb; credit_before bigint; mode text;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  if jsonb_typeof(p_batch) <> 'array' or exists (select 1 from jsonb_array_elements(p_batch) l where l ->> 'op' is null or l ->> 'op' not in ('event', 'mint', 'metal', 'career_set')) then
    raise exception 'a kill batch carries only event, mint, metal and career_set ops' using errcode = 'O0002'; end if;
  select * into cfg from public.origins_world_config;
  select * into e from public.origins_spawn_engages where token = p_token and account = p_account and used_at is null and expires_at > now() for update;
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  select * into s from public.origins_spawns where layer = e.layer and instance = e.instance for update;
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
  if exists (select 1 from public.origins_spawn_engages x where x.account = p_account and x.instance = e.instance and x.layer <> e.layer and x.result = 'killed' and x.used_at > now() - make_interval(secs => least(greatest(p_respawn_s, 10), 86400))) then
    return jsonb_build_object('refused', 'cooldown');
  end if;
  update public.origins_spawn_engages set used_at = now(), result = 'killed' where token = p_token;
  if mode = 'first' then
    update public.origins_spawns set alive = false, generation = e.generation, respawn_at = now() + make_interval(secs => least(greatest(p_respawn_s, 10), 86400)), killed_by = p_account, killed_at = now()
      where layer = e.layer and instance = e.instance returning * into s;
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
  insert into public.origins_spawn_damage (token, instance, layer, generation, account, damage, joined) values (p_token, e.instance, e.layer, e.generation, p_account, greatest(coalesce(p_damage, 0), 0), mode = 'join');
  return jsonb_build_object('result', 'killed', 'instance', s.instance, 'respawnAt', s.respawn_at, 'joined', mode = 'join', 'applied', out);
end $$;

-- The janitor's one call: delete the spawn rows of every layer NOT in p_live (the layers presence says exist now). Safe: a row is only "dead until T", and a layer that comes back starts all-alive like any fresh layer.
-- Open engages cannot belong to a layer empty for 300 s (token ttl 120 s); engages and the beta ledger are never touched. Returns the number of rows deleted. A null list is refused, so "presence did not answer"
-- can never read as "no layer is live".
create function public.origins_spawn_layers_sweep(p_live int[]) returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_live is null then raise exception 'the live layer list is required' using errcode = 'O0002'; end if;
  delete from public.origins_spawns s where not (s.layer = any(p_live));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.origins_spawn_state_layer(int, text[]), public.origins_spawn_engage_layer(int, uuid, text, text, text, text), public.origins_spawn_check_layer(uuid, text, int, int, int),
  public.origins_spawn_damage_read_layer(int, text, int), public.origins_spawn_layers_sweep(int[]) from public, anon, authenticated;
grant execute on function public.origins_spawn_state_layer(int, text[]), public.origins_spawn_engage_layer(int, uuid, text, text, text, text), public.origins_spawn_check_layer(uuid, text, int, int, int),
  public.origins_spawn_damage_read_layer(int, text, int), public.origins_spawn_layers_sweep(int[]) to frankendom_origins, frankendom_verifier;
commit;
