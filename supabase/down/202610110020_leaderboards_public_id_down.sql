begin;
-- Undoes 202610110020_leaderboards_public_id.sql: the 0019 leaderboards() body back, and the public number removed (it was only ever read by that function).
drop function if exists public.leaderboards(integer);
create function public.leaderboards(p_limit integer default 20) returns table (board text, place integer, display_name text, score integer)
language sql stable security definer set search_path = '' as $$
  with lim as (select greatest(1, least(coalesce(p_limit, 20), 50)) n),
  a as (select 'duel_rating'::text board, row_number() over (order by d.rating desc, p.display_name)::integer place, p.display_name, d.rating score
        from public.duel_ratings d join public.fighter_profiles p on p.user_id = d.user_id),
  b as (select 'duel_wins'::text board, row_number() over (order by w.n desc, p.display_name)::integer place, p.display_name, w.n::integer score
        from (select user_id, count(*) n from public.fight_results where kind = 'duel' and result = 'win' group by user_id) w join public.fighter_profiles p on p.user_id = w.user_id)
  select a.board, a.place, a.display_name, a.score from a, lim where a.place <= lim.n
  union all select b.board, b.place, b.display_name, b.score from b, lim where b.place <= lim.n
  order by 1, 2
$$;
revoke all on function public.leaderboards(integer) from public, anon;
grant execute on function public.leaderboards(integer) to authenticated;
alter table public.fighter_profiles drop column if exists public_no;
commit;
