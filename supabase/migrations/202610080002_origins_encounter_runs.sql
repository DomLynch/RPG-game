-- DRAFT, NOT FOR APPLY (class 1: new tables and functions only, no ALTER, no grant on a live table; needs the Auditor's PRE and Lead + Strategy's joint GO).
-- World creature fights, server side (docs/specs/origins/server-save-schema.md ruling 6): the encounter token the migration 202610060001 already carries (origins_encounters:
-- token, seed, enemy, level, expiry, used) gets its RUN: the parameters the SERVER holds for the fight (start tick, one-health-bar pool, twist flags, mob layer, the shared creature
-- instance) so a client can never name them, and the lifecycle (last tick seen, reconnect grace, result). The writer re-simulates the posted record with THESE parameters
-- (verifyEncounter) and only a verified record writes anything, through the event id `enc:<token>` (kind 'mob', already allowed). An open fight whose grace runs out is settled by the
-- sweep as a loss by abandonment (never dropped silently), the creature is released (it resets: nobody inherits a half-dead mob), and the same event id keeps it paid or lost once.
--   * the token still comes from origins_issue_encounter (unchanged); origins_encounter_start wraps it and adds the run and the creature claim in ONE transaction
--   * one open fight per account; one open fight per shared creature instance (claimed by INSERT .. ON CONFLICT DO UPDATE .. WHERE the claimant is no longer live; the sweep uses FOR UPDATE SKIP LOCKED)
--   * reconnect grace = origins_encounter_runs.grace_s (120 s) from the last touch, capped at one hour from the start; a touch inside the grace is the SAME token and seed
--   * the writer connects as frankendom_verifier (the Origins writer's env since 202610080001): every function is granted to BOTH frankendom_origins and frankendom_verifier
begin;

create table public.origins_encounter_runs (
  token text primary key references public.origins_encounters (token) on delete cascade,
  start_tick int not null default 0 check (start_tick >= 0),
  last_tick int not null default 0 check (last_tick >= 0),
  bar int check (bar is null or bar between 1 and 1000000),
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array' and jsonb_array_length(flags) <= 8),
  layer text check (layer is null or layer ~ '^[a-z0-9._:-]{1,64}$'),
  instance text check (instance is null or instance ~ '^[a-z0-9._:-]{1,96}$'),
  grace_s int not null default 120 check (grace_s between 30 and 600),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  settled_at timestamptz,
  result text check (result in ('won', 'lost', 'abandoned'))
);
create index origins_encounter_runs_open on public.origins_encounter_runs (token) where settled_at is null;

-- One live claimant per shared creature instance; a claim is stale once its run is settled or its encounter expired, and the next claim takes it over.
create table public.origins_creature_claims (
  instance text primary key check (instance ~ '^[a-z0-9._:-]{1,96}$'),
  token text not null references public.origins_encounters (token) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.origins_encounter_runs enable row level security;
alter table public.origins_creature_claims enable row level security;
revoke all on public.origins_encounter_runs, public.origins_creature_claims from public, anon, authenticated;   -- no policy, no grant: only the definer functions below touch them

-- Start: issue the token (the one definition, origins_issue_encounter) and record what the server holds. The token's own expiry is the grace from now.
create function public.origins_encounter_start(p_account uuid, p_character text, p_token text, p_seed bigint, p_enemy text, p_level int, p_start_tick int, p_bar int, p_flags jsonb, p_layer text, p_instance text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare grace int := 120;
begin
  perform public.origins_issue_encounter(p_account, p_character, p_token, p_seed, p_enemy, p_level, grace);   -- first: a closed origins or a character that is not the account's is O0007 before anything else is revealed
  if exists (select 1 from public.origins_encounter_runs r join public.origins_encounters e on e.token = r.token
             where e.account = p_account and e.token <> p_token and r.settled_at is null and e.used_at is null and e.expires_at > now()) then
    raise exception 'a fight is already open for this account: resume it' using errcode = 'O0014'; end if;
  insert into public.origins_encounter_runs (token, start_tick, last_tick, bar, flags, layer, instance, grace_s)
    values (p_token, p_start_tick, p_start_tick, p_bar, coalesce(p_flags, '[]'::jsonb), p_layer, p_instance, grace);
  if p_instance is not null then
    insert into public.origins_creature_claims as c (instance, token) values (p_instance, p_token)
      on conflict (instance) do update set token = excluded.token, claimed_at = now()
      where not exists (select 1 from public.origins_encounter_runs r join public.origins_encounters e on e.token = r.token
                        where r.token = c.token and r.settled_at is null and e.used_at is null and e.expires_at > now());
    if not found then raise exception 'creature % is in another fight', p_instance using errcode = 'O0014'; end if;
  end if;
  return public.origins_encounter_get(p_account, p_token);
end $$;

-- The parameters the writer re-simulates with (and the state a resuming client reads). Any status; the writer decides what a settled or expired run means.
create function public.origins_encounter_get(p_account uuid, p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('token', e.token, 'character', e.character, 'seed', e.seed, 'enemy', e.enemy, 'level', e.enemy_level, 'expires_at', e.expires_at, 'used', e.used_at is not null,
    'start_tick', r.start_tick, 'last_tick', r.last_tick, 'bar', r.bar, 'flags', r.flags, 'layer', r.layer, 'instance', r.instance, 'grace_s', r.grace_s, 'settled', r.settled_at is not null, 'result', r.result)
  from public.origins_encounters e join public.origins_encounter_runs r on r.token = e.token where e.token = p_token and e.account = p_account
$$;

-- A touch inside the grace: the same token and seed continue; refused (O0009) once settled, used or expired. The grace restarts, but never past one hour from the start.
create function public.origins_encounter_touch(p_account uuid, p_token text, p_tick int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.origins_encounter_runs;
begin
  update public.origins_encounter_runs r2 set last_tick = greatest(r2.last_tick, p_tick), last_seen_at = now()
    from public.origins_encounters e
    where e.token = r2.token and e.token = p_token and e.account = p_account and e.used_at is null and r2.settled_at is null and e.expires_at > now() returning r2.* into r;
  if not found then raise exception 'encounter token unknown, used or expired' using errcode = 'O0009'; end if;
  update public.origins_encounters set expires_at = least(now() + make_interval(secs => r.grace_s), r.created_at + interval '1 hour') where token = p_token;
  return public.origins_encounter_get(p_account, p_token);
end $$;

-- Settle a fight the writer VERIFIED (or judged lost): consume the token, close the run, release the creature and apply the writer's batch (the event `enc:<token>` and any
-- reward lines) in ONE transaction. A second settle, or a settle after the expiry sweep, aborts with O0009 and writes nothing.
create function public.origins_encounter_settle(p_account uuid, p_token text, p_result text, p_ticks int, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  if p_result not in ('won', 'lost') then raise exception 'result must be won or lost' using errcode = 'O0002'; end if;
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  perform 1 from public.origins_encounters e join public.origins_encounter_runs r on r.token = e.token
    where e.token = p_token and e.account = p_account and e.used_at is null and r.settled_at is null and e.expires_at > now() for update of e, r;
  if not found then raise exception 'encounter token unknown, used or expired' using errcode = 'O0009'; end if;
  update public.origins_encounters set used_at = now() where token = p_token;
  update public.origins_encounter_runs set settled_at = now(), result = p_result, last_tick = greatest(last_tick, coalesce(p_ticks, 0)) where token = p_token;
  delete from public.origins_creature_claims where token = p_token;
  out := public.origins_apply(p_batch, array[p_account]);
  return out;
end $$;

-- The sweep: every open fight past its grace is a loss by abandonment, recorded once under the same event id (a fight settled in time is untouched). The creature claim is dropped
-- (it resets). FOR UPDATE SKIP LOCKED: two sweeps, or a sweep and a settle, never wait on or double-handle a row. Returns how many it settled.
create function public.origins_encounter_expire(p_limit int) returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; t record;
begin
  for t in select e.token, e.account, e.character, r.last_tick from public.origins_encounters e join public.origins_encounter_runs r on r.token = e.token
           where e.used_at is null and r.settled_at is null and e.expires_at <= now() order by e.expires_at limit greatest(least(p_limit, 500), 1) for update of e, r skip locked loop
    update public.origins_encounters set used_at = now() where token = t.token;
    update public.origins_encounter_runs set settled_at = now(), result = 'abandoned' where token = t.token;
    delete from public.origins_creature_claims where token = t.token;
    insert into public.origins_events (event_id, kind, account, character, payload) values ('enc:' || t.token, 'mob', t.account, t.character, jsonb_build_object('result', 'abandoned', 'ticks', t.last_tick));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function
  public.origins_encounter_start(uuid, text, text, bigint, text, int, int, int, jsonb, text, text), public.origins_encounter_get(uuid, text),
  public.origins_encounter_touch(uuid, text, int), public.origins_encounter_settle(uuid, text, text, int, jsonb), public.origins_encounter_expire(int) from public, anon, authenticated;
grant execute on function
  public.origins_encounter_start(uuid, text, text, bigint, text, int, int, int, jsonb, text, text), public.origins_encounter_get(uuid, text),
  public.origins_encounter_touch(uuid, text, int), public.origins_encounter_settle(uuid, text, text, int, jsonb), public.origins_encounter_expire(int)
  to frankendom_origins, frankendom_verifier;
commit;
