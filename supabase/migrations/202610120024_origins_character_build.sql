begin;
-- ROLLBACK: supabase/down/202610120024_origins_character_build_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: one table, three functions. Dom's LOCKED sheet (programme 2a): level 1..50, one point a level, spendable on ANY dial or skill; everyone starts at 50 on everything.
-- A character's BUILD is its level plus the points PLACED on each dial or skill id (the rows decide ids, bases, caps; the writer validates every save with the shared validateBuild).
-- RE-SPREAD is free until level 10, then once per rank-up (every 10 levels): respread_rank is the rank (level / 10) at which the last paid re-spread was used; it starts at 1, so levels 11-19 have none.
-- No row = level 1, nothing placed, version 0.
-- RLS on, no policy, no client grant: only the definer functions below touch it. Level has no client path: origins_set_level is the writer's, and only ever raises it.
create table public.origins_character_build (
  character text primary key references public.origins_characters (id) on delete cascade,
  level int not null default 1 check (level between 1 and 50),
  placed jsonb not null default '{}'::jsonb check (jsonb_typeof(placed) = 'object'),
  respread_rank int not null default 1,
  version int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.origins_character_build enable row level security;
revoke all on public.origins_character_build from public, anon, authenticated;

-- The build of one of the account's own characters; null when it is not theirs.
create function public.origins_get_build(p_account uuid, p_character text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b public.origins_character_build;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  select * into b from public.origins_character_build where character = p_character;
  if not found then return jsonb_build_object('level', 1, 'placed', '{}'::jsonb, 'respreadRank', 1, 'version', 0); end if;
  return jsonb_build_object('level', b.level, 'placed', b.placed, 'respreadRank', b.respread_rank, 'version', b.version);
end $$;

-- Replace the placed points (and the re-spread rank, when this save used a paid re-spread) if the stored version is still p_expected (0 = no row yet). {conflict:true,...current} when it moved; null when not the account's.
create function public.origins_set_build(p_account uuid, p_character text, p_placed jsonb, p_respread_rank int, p_expected int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cur jsonb; v int; n int;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  insert into public.origins_character_build (character) values (p_character) on conflict (character) do nothing;
  update public.origins_character_build set placed = p_placed, respread_rank = p_respread_rank, version = version + 1, updated_at = now()
   where character = p_character and version = p_expected
  returning version into v;
  get diagnostics n = row_count;
  if n = 0 then
    select jsonb_build_object('conflict', true, 'level', level, 'placed', placed, 'respreadRank', respread_rank, 'version', version) into cur from public.origins_character_build where character = p_character;
    return cur;
  end if;
  return jsonb_build_object('level', (select level from public.origins_character_build where character = p_character), 'placed', p_placed, 'respreadRank', p_respread_rank, 'version', v);
end $$;

-- The writer raises a character's level (never lowers it). Returns the level now stored; null when not the account's.
create function public.origins_set_level(p_account uuid, p_character text, p_level int) returns int language plpgsql security definer set search_path = '' as $$
declare l int;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  insert into public.origins_character_build (character, level) values (p_character, p_level)
  on conflict (character) do update set level = greatest(public.origins_character_build.level, excluded.level), updated_at = now() returning level into l;
  return l;
end $$;

revoke all on function public.origins_get_build(uuid, text), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) from public, anon, authenticated;
grant execute on function public.origins_get_build(uuid, text), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) to frankendom_origins;
commit;
