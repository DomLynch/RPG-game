begin;
-- ROLLBACK: supabase/down/202610130030_character_renown_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: one table, two definer functions. A character's FAME (0..15000) and KARMA (-15000..15000), UO's scale (Characters' title rows, src/fight/title-rows.json, use the same floors).
-- Storage and read only: WHO awards fame or karma, and how much, comes later as rows. No row = fame 0, karma 0. The pair is cosmetic prestige (a title), never points.
-- RLS on, no policy, no client grant: the writer roles do not bypass RLS, so the table is reachable only through the two definer functions (as origins_character_build is).
--   origins_get_renown(account, character)                      -> { fame, karma } for a character the account owns; null when it is not the account's. Writer and verifier.
--   origins_add_renown(account, character, d_fame, d_karma)     -> the new { fame, karma } after adding the deltas, each CLAMPED to its range; null when not the account's. Writer only.
create table public.origins_character_renown (
  character text primary key references public.origins_characters (id) on delete cascade,
  fame int not null check (fame between 0 and 15000),
  karma int not null check (karma between -15000 and 15000),
  updated_at timestamptz not null default now()
);
alter table public.origins_character_renown enable row level security;
revoke all on public.origins_character_renown from public, anon, authenticated;

create function public.origins_get_renown(p_account uuid, p_character text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.origins_character_renown;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  select * into r from public.origins_character_renown where character = p_character;
  if not found then return jsonb_build_object('fame', 0, 'karma', 0); end if;
  return jsonb_build_object('fame', r.fame, 'karma', r.karma);
end $$;

create function public.origins_add_renown(p_account uuid, p_character text, p_d_fame int, p_d_karma int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.origins_character_renown;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  if p_d_fame is null or p_d_karma is null or abs(p_d_fame) > 100000 or abs(p_d_karma) > 100000 then raise exception 'renown: a delta within 100000' using errcode = 'O0002'; end if;
  insert into public.origins_character_renown as t (character, fame, karma)
    values (p_character, greatest(0, least(15000, p_d_fame)), greatest(-15000, least(15000, p_d_karma)))
    on conflict (character) do update set fame = greatest(0, least(15000, t.fame + p_d_fame)), karma = greatest(-15000, least(15000, t.karma + p_d_karma)), updated_at = now()
    returning * into r;
  return jsonb_build_object('fame', r.fame, 'karma', r.karma);
end $$;

revoke all on function public.origins_get_renown(uuid, text), public.origins_add_renown(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.origins_get_renown(uuid, text) to frankendom_origins, frankendom_verifier;
grant execute on function public.origins_add_renown(uuid, text, int, int) to frankendom_origins, frankendom_verifier;
commit;
