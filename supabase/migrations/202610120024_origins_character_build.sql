begin;
-- ROLLBACK: supabase/down/202610120024_origins_character_build_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: one table, three functions. Dom's LOCKED sheet (programme 2a): level 1..50, one point a level, spendable on ANY dial or skill; everyone starts at 50 on everything.
-- A character's BUILD is its level plus the points PLACED on each dial or skill id (the rows decide ids, bases, caps; the writer validates every save with the shared validateBuild).
-- RE-SPREAD is free until level 10, then once per rank-up (every 10 levels): respread_rank is the rank (level / 10) at which the last paid re-spread was used; it starts at 1, so levels 11-19 have none.
-- No row = level 1, nothing placed, version 0.
-- APPEND-ONLY (Lead's ruling): every change is a NEW immutable version row (character, version, level, placed, respread_rank, created_at); the current build is the max version, so a fight record that names
-- (character, version) can be checked against exactly that build and a re-spread cannot rewrite history. Level has no client path: origins_set_level is the writer's, and only ever raises it.
-- RLS on, no policy, no client grant: only the definer functions below touch it.
create table public.origins_character_build (
  character text not null references public.origins_characters (id) on delete cascade,
  version int not null check (version >= 1),
  level int not null check (level between 1 and 50),
  placed jsonb not null check (jsonb_typeof(placed) = 'object'),
  respread_rank int not null check (respread_rank >= 0),
  created_at timestamptz not null default now(),
  primary key (character, version)
);
alter table public.origins_character_build enable row level security;
revoke all on public.origins_character_build from public, anon, authenticated;

-- One version of one of the account's own characters (the current one when p_version is null); null when it is not theirs or the version does not exist. Version 0 is the default build, never stored.
create function public.origins_get_build(p_account uuid, p_character text, p_version int default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b public.origins_character_build;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  select * into b from public.origins_character_build where character = p_character and (p_version is null or version = p_version) order by version desc limit 1;
  if not found then
    if p_version is null or p_version = 0 then return jsonb_build_object('level', 1, 'placed', '{}'::jsonb, 'respreadRank', 1, 'version', 0); end if;
    return null;
  end if;
  return jsonb_build_object('level', b.level, 'placed', b.placed, 'respreadRank', b.respread_rank, 'version', b.version);
end $$;

-- Append version p_expected + 1 if the current version is still p_expected (0 = none yet). {conflict:true,...current} when it moved; null when not the account's.
create function public.origins_set_build(p_account uuid, p_character text, p_placed jsonb, p_respread_rank int, p_expected int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cur public.origins_character_build; lv int := 1; cv int := 0;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  select * into cur from public.origins_character_build where character = p_character order by version desc limit 1;
  if found then lv := cur.level; cv := cur.version; end if;
  if cv <> p_expected then return public.origins_get_build(p_account, p_character) || '{"conflict":true}'::jsonb; end if;
  begin
    insert into public.origins_character_build (character, version, level, placed, respread_rank) values (p_character, p_expected + 1, lv, p_placed, p_respread_rank);
  exception when unique_violation then
    return public.origins_get_build(p_account, p_character) || '{"conflict":true}'::jsonb;
  end;
  return jsonb_build_object('level', lv, 'placed', p_placed, 'respreadRank', p_respread_rank, 'version', p_expected + 1);
end $$;

-- The writer raises a character's level (never lowers it): a new version with the same placement. Returns the level now stored; null when not the account's.
create function public.origins_set_level(p_account uuid, p_character text, p_level int) returns int language plpgsql security definer set search_path = '' as $$
declare cur jsonb; v int;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  cur := public.origins_get_build(p_account, p_character);
  if p_level <= (cur->>'level')::int then return (cur->>'level')::int; end if;
  v := (cur->>'version')::int + 1;
  begin
    insert into public.origins_character_build (character, version, level, placed, respread_rank) values (p_character, v, p_level, cur->'placed', (cur->>'respreadRank')::int);
  exception when unique_violation then
    return (public.origins_get_build(p_account, p_character)->>'level')::int;
  end;
  return p_level;
end $$;

revoke all on function public.origins_get_build(uuid, text, int), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) from public, anon, authenticated;
grant execute on function public.origins_get_build(uuid, text, int), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) to frankendom_origins;
commit;
