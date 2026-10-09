begin;
-- ROLLBACK: supabase/down/202610080011_duel_season_archive_down.sql (drops exactly what this file creates; refuses while the archive holds a season).
-- CLASS 1, ADDITIVE: one new table and one new function. No existing table, function, grant or policy is altered.
-- Why (R1 / season start; Strategy + COO + Lead 2026-10-08 under Dom's delegation): the duel ladder is ARCHIVED, then reset, never hard-deleted. A season's
-- final ratings are kept in duel_season_ratings (each player can view their own, as with the live ladder), then the live ladder starts fresh.
-- duel_counted_wins is the anti-farm day log, not a rank, and is left as it is. Dropping the live ladder table is NOT done here and needs Dom's own words.
create table public.duel_season_ratings (
  season text not null check (season ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 10000),
  updated_at timestamptz not null,           -- the live row's last change
  archived_at timestamptz not null default now(),
  primary key (season, user_id)
);
alter table public.duel_season_ratings enable row level security;
revoke all on public.duel_season_ratings from public, anon, authenticated;
grant select on public.duel_season_ratings to authenticated;
create policy "own season ratings" on public.duel_season_ratings for select to authenticated using (user_id = (select auth.uid()));

-- Close a season, in ONE transaction: lock the ladder, copy every row into the archive under `p_season`, VERIFY the archive holds exactly the live rows
-- (count and the rating sum, row by row), and only then empty the live ladder. Any mismatch raises and nothing changes. A season name is used once.
-- Run by hand at the season start (service role / dashboard SQL); no client or writer role can call it.
create function public.duel_season_close(p_season text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare live_n bigint; live_sum bigint; arch_n bigint; arch_sum bigint; diff bigint;
begin
  if p_season is null or p_season !~ '^[a-z0-9][a-z0-9-]{0,31}$' then raise exception 'season name must be lower-case kebab, 1-32 chars' using errcode = '22023'; end if;
  if exists (select 1 from public.duel_season_ratings where season = p_season) then raise exception 'season % is already archived', p_season using errcode = '23505'; end if;
  lock table public.duel_ratings in exclusive mode;   -- the verifier sweep's duel_count_win waits until the reset commits
  select count(*), coalesce(sum(rating), 0) into live_n, live_sum from public.duel_ratings;
  insert into public.duel_season_ratings (season, user_id, rating, updated_at) select p_season, user_id, rating, updated_at from public.duel_ratings;
  select count(*), coalesce(sum(rating), 0) into arch_n, arch_sum from public.duel_season_ratings where season = p_season;
  select count(*) into diff from public.duel_ratings r
    where not exists (select 1 from public.duel_season_ratings a where a.season = p_season and a.user_id = r.user_id and a.rating = r.rating);
  if arch_n <> live_n or arch_sum <> live_sum or diff <> 0 then
    raise exception 'archive check failed: live %/% vs archived %/%, % rows differ; nothing reset', live_n, live_sum, arch_n, arch_sum, diff using errcode = 'P0001';
  end if;
  delete from public.duel_ratings;
  return jsonb_build_object('season', p_season, 'archived', arch_n, 'rating_sum', arch_sum, 'live_after', (select count(*) from public.duel_ratings));
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation (the trap #1639 hit): revoke them; no role is granted it.
revoke all on function public.duel_season_close(text) from public, anon, authenticated;
commit;
