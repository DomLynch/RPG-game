begin;
-- ROLLBACK: supabase/down/202610070009_origins_character_location_down.sql (drops exactly what this file creates).
-- Launch gate X2 Stage 2, the writer half (docs/specs/origins/x2-presence-saved-location.md, PR #1575; Lead's FINAL rulings and Strategy's rules on #1575).
-- CLASS 1, ADDITIVE and Origins-only: two new tables and four new functions. No existing table, function, grant or policy is altered; the only existing
-- objects referenced are auth.users and origins_characters (foreign keys, on delete cascade, so erasure and origins_purge_account clear these rows too).
-- Numbered 0009, after #1522's pending 0005/0007/0008, so the two cannot collide whichever lands first.
--
-- origins_character_location: where the server last saw a CHARACTER, {zone, x, z, updated_at}, in presence centimetres (the 300 m town square). It is
-- written ONLY from presence's own observation (the writer's internal route, presence's key + loopback); no client op writes it.
-- origins_active_character: ONE active character per account (Lead's ruling 2). Presence keys by account; the writer maps account -> active character when it
-- stores a position and when it serves one. Set by the writer's client ops create_character (the new character) and open {character} (one of the account's own).
-- Both tables: RLS on, no policy, no grant to anon/authenticated and none to the writer role: only the definer functions below touch them.

create table public.origins_active_character (
  account uuid primary key references auth.users (id) on delete cascade,
  character text not null references public.origins_characters (id) on delete cascade,
  set_at timestamptz not null default now()
);
create index origins_active_character_character on public.origins_active_character (character);

create table public.origins_character_location (
  character text primary key references public.origins_characters (id) on delete cascade,
  zone text check (zone is null or zone ~ '^[a-z][a-z0-9-]{0,31}$'),   -- null: in neither zone (the open ground between them), as presence's zoneAt says
  x int not null check (x between 0 and 30000),
  z int not null check (z between 0 and 30000),
  updated_at timestamptz not null
);

alter table public.origins_active_character enable row level security;
alter table public.origins_character_location enable row level security;
revoke all on public.origins_active_character, public.origins_character_location from public, anon, authenticated;

-- ---- the writer's functions (security definer; execute for frankendom_origins only) -------------------------------------------------

-- Make one of the account's own characters its active one. False (and nothing written) when the character is not this account's.
create function public.origins_set_active(p_account uuid, p_character text) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  if not public.origins_owns(p_character, p_account) then return false; end if;
  insert into public.origins_active_character (account, character) values (p_account, p_character)
  on conflict (account) do update set character = excluded.character, set_at = now();
  return true;
end $$;

-- Presence's observation of an ACCOUNT, stored for its active character. The latest observation wins: one older than the stored row (a retried post arriving
-- after a newer one) changes nothing, and an observation time in the future is taken as now. Returns {character, stored}; character null (nothing written)
-- when Origins is not open for the account or it has no active character.
create function public.origins_save_location(p_account uuid, p_x int, p_z int, p_zone text, p_at_ms bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cid text; n int;
begin
  if not public.origins_allowed(p_account) then return jsonb_build_object('character', null, 'stored', false); end if;
  select a.character into cid from public.origins_active_character a join public.origins_characters c on c.id = a.character and c.account = a.account where a.account = p_account;
  if cid is null then return jsonb_build_object('character', null, 'stored', false); end if;
  insert into public.origins_character_location (character, zone, x, z, updated_at) values (cid, p_zone, p_x, p_z, least(to_timestamp(p_at_ms / 1000.0), now()))
  on conflict (character) do update set zone = excluded.zone, x = excluded.x, z = excluded.z, updated_at = excluded.updated_at
  where public.origins_character_location.updated_at <= excluded.updated_at;
  get diagnostics n = row_count;
  return jsonb_build_object('character', cid, 'stored', n > 0);
end $$;

-- The active character's saved location, or null (Origins not open, no active character, or nothing saved for it). The writer applies the rejoin rules
-- (a trade area moves to its edge; a server-held state overrides) before presence sees it.
create function public.origins_saved_location(p_account uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.origins_allowed(p_account) then (
    select jsonb_build_object('character', l.character, 'zone', l.zone, 'x', l.x, 'z', l.z, 'updated_at', l.updated_at)
    from public.origins_active_character a
    join public.origins_characters c on c.id = a.character and c.account = a.account
    join public.origins_character_location l on l.character = a.character
    where a.account = p_account) end
$$;

-- The account's active character id, or null.
create function public.origins_active(p_account uuid) returns text language sql stable security definer set search_path = '' as $$
  select a.character from public.origins_active_character a join public.origins_characters c on c.id = a.character and c.account = a.account
  where a.account = p_account and public.origins_allowed(p_account)
$$;

revoke all on function public.origins_set_active(uuid, text), public.origins_save_location(uuid, int, int, text, bigint), public.origins_saved_location(uuid), public.origins_active(uuid)
  from public, anon, authenticated;
grant execute on function public.origins_set_active(uuid, text), public.origins_save_location(uuid, int, int, text, bigint), public.origins_saved_location(uuid), public.origins_active(uuid)
  to frankendom_origins;

commit;
