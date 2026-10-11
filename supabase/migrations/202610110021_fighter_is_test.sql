begin;
-- Production QA account (Lead 2026-10-11): fighter_profiles.is_test marks the one service-role-created test account so it never appears on a public board.
--  * is_test: not null, default false, not client-writable (the insert/update grants are per column and do not name it). Existing rows read false.
--  * leaderboards() (duel_rating, duel_wins) and the daily_board view (feeds daily_board_summary) skip is_test fighters. Same shapes as before. Own-row readers (scorecard_rows, pit_ladder, control_trials) are untouched: they only ever show the caller its own rows.
alter table public.fighter_profiles add column is_test boolean not null default false;
create or replace function public.leaderboards(p_limit integer default 20) returns table (board text, place integer, display_name text, score integer, fighter_id integer)
language sql stable security definer set search_path = '' as $$
  with lim as (select greatest(1, least(coalesce(p_limit, 20), 50)) n),
  a as (select 'duel_rating'::text board, row_number() over (order by d.rating desc, p.public_no)::integer place, p.public_no, d.rating score
        from public.duel_ratings d join public.fighter_profiles p on p.user_id = d.user_id where not p.is_test),
  b as (select 'duel_wins'::text board, row_number() over (order by w.n desc, p.public_no)::integer place, p.public_no, w.n::integer score
        from (select user_id, count(*) n from public.fight_results where kind = 'duel' and result = 'win' group by user_id) w join public.fighter_profiles p on p.user_id = w.user_id where not p.is_test)
  select a.board, a.place, 'Fighter #' || a.public_no, a.score, a.public_no from a, lim where a.place <= lim.n
  union all select b.board, b.place, 'Fighter #' || b.public_no, b.score, b.public_no from b, lim where b.place <= lim.n
  order by 1, 2
$$;
create or replace view public.daily_board as
  select r.day, r.number, r.opponent, r.weapon, r.outcome, r.ticks, r.location, r.taken, r.verified, r.created_at, p.display_name
  from public.daily_results r left join public.fighter_profiles p on p.user_id = r.user_id where not coalesce(p.is_test, false);
commit;
