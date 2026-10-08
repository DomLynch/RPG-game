-- CLASS 1, ADDITIVE and Origins-only: three new tables (RLS on, no policy, no grant), four new definer functions granted to the two writer roles. No existing table, function,
-- grant or policy is altered. ROLLBACK: supabase/down/202610080014_origins_world_spawns_down.sql (drops exactly what this file creates).
-- Why (Strategy, Dom's direction 2026-10-08 ~19:00 +04: Zone 1 is DETACHED from the Pit): a world creature fight is played on the page in real time, with no duel record. The server
-- owns the creature's life instead (EverQuest's spawn2 pattern: the server holds each spawn point's alive/respawn timer, the client never names a corpse): a player ENGAGES a live
-- spawn (a single-use token, one per instance per account, at most `max_open` open per account), keeps it alive with touches, and a KILL REPORT consumes the token, marks the spawn
-- dead with the server's respawn clock, and applies the writer's reward batch, all in ONE transaction. Two players may both engage one creature: the first valid kill wins, the
-- other's report answers 'dead'. A refusal (dead, too many, cap, too fast) is returned as {refused: <why>} and writes nothing. A token unknown, used or expired raises O0009.
-- The writer derives the instance list from the same pure mobSpecs the page draws (ids like wolves-1), so a spawn row is created on its first engage (generation 0).
begin;

create table public.origins_world_config (
  id boolean primary key default true check (id),
  engage_ttl_s int not null default 120 check (engage_ttl_s between 30 and 1800),   -- a token lives this long after its LAST touch (fights last 30 s .. 20 min)
  max_open int not null default 4 check (max_open between 1 and 16),                 -- open engages per account (a pack)
  kills_per_min int not null default 6 check (kills_per_min between 1 and 60),
  kills_per_hour int not null default 120 check (kills_per_hour between 1 and 3600)
);
insert into public.origins_world_config default values;

create table public.origins_spawns (
  instance text primary key check (instance ~ '^[a-z0-9._:-]{1,96}$'),
  kind text not null check (kind ~ '^[a-z0-9._:-]{1,64}$'),
  generation int not null default 0 check (generation >= 0),
  alive boolean not null default true,
  respawn_at timestamptz,
  killed_by uuid,
  killed_at timestamptz
);

create table public.origins_spawn_engages (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16,128}$'),
  account uuid not null,
  character text not null,
  instance text not null references public.origins_spawns (instance),
  generation int not null,
  issued_at timestamptz not null default now(),
  touched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  result text check (result in ('killed', 'dead'))
);
create index origins_spawn_engages_open on public.origins_spawn_engages (account, instance) where used_at is null;
create index origins_spawn_engages_kills on public.origins_spawn_engages (account, used_at desc) where result = 'killed';

alter table public.origins_world_config enable row level security;
alter table public.origins_spawns enable row level security;
alter table public.origins_spawn_engages enable row level security;
revoke all on public.origins_world_config, public.origins_spawns, public.origins_spawn_engages from public, anon, authenticated;   -- no policy, no grant: only the definer functions touch them

-- A dead spawn whose respawn time has passed is alive again (generation + 1). Used by every function below so the clock is the database's.
create function public.origins_spawn_view(s public.origins_spawns) returns jsonb language sql stable set search_path = '' as $$
  select case when s.alive or s.respawn_at <= now()
    then jsonb_build_object('instance', s.instance, 'kind', s.kind, 'alive', true, 'respawnAt', null, 'generation', s.generation + (case when s.alive then 0 else 1 end))
    else jsonb_build_object('instance', s.instance, 'kind', s.kind, 'alive', false, 'respawnAt', s.respawn_at, 'generation', s.generation) end
$$;

-- Read-only: the server's state of the named instances (never-engaged ones are not listed: the writer reads them as alive, generation 0) and the database clock.
create function public.origins_spawn_state(p_instances text[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('now', now(), 'spawns', coalesce((select jsonb_agg(public.origins_spawn_view(s) order by s.instance) from public.origins_spawns s where s.instance = any(p_instances)), '[]'::jsonb))
$$;

-- Engage a LIVE spawn. Re-engaging an instance this account already holds open returns that token (no second token, no new issue time).
create function public.origins_spawn_engage(p_account uuid, p_character text, p_token text, p_instance text, p_kind text) returns jsonb language plpgsql security definer set search_path = '' as $$
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

-- Keep an engage alive: expires `engage_ttl_s` after this touch. O0009 once used or expired.
create function public.origins_spawn_touch(p_account uuid, p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.origins_spawn_engages;
begin
  update public.origins_spawn_engages set touched_at = now(), expires_at = now() + make_interval(secs => (select engage_ttl_s from public.origins_world_config))
    where token = p_token and account = p_account and used_at is null and expires_at > now() returning * into e;
  if not found then raise exception 'engage token unknown, used or expired' using errcode = 'O0009'; end if;
  return jsonb_build_object('token', e.token, 'expiresAt', e.expires_at);
end $$;

-- The kill report. The writer has already checked reach and the hit floor; the database checks what only it can: the token is open, the spawn is alive at the token's generation,
-- the time since issue is at least p_min_ms (the time-to-kill floor from the creature's HP), and the account's kills in the last minute / hour are under the caps. Then ONE
-- transaction: consume the token, mark the spawn dead until now() + p_respawn_s, apply p_batch (the kill event and its reward lines). A second report raises O0009.
create function public.origins_spawn_kill(p_account uuid, p_token text, p_min_ms int, p_respawn_s int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cfg public.origins_world_config; e public.origins_spawn_engages; s public.origins_spawns; out jsonb;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
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
  out := public.origins_apply(p_batch, array[p_account]);
  return jsonb_build_object('result', 'killed', 'instance', s.instance, 'respawnAt', s.respawn_at, 'applied', out);
end $$;

revoke all on function public.origins_spawn_view(public.origins_spawns), public.origins_spawn_state(text[]), public.origins_spawn_engage(uuid, text, text, text, text),
  public.origins_spawn_touch(uuid, text), public.origins_spawn_kill(uuid, text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.origins_spawn_state(text[]), public.origins_spawn_engage(uuid, text, text, text, text),
  public.origins_spawn_touch(uuid, text), public.origins_spawn_kill(uuid, text, int, int, jsonb) to frankendom_origins, frankendom_verifier;
commit;
