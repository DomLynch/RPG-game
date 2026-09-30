begin;
-- The daily board's headlines, computed on the server over every row of the day (Auditer finding, 2026-09-22). The client used to
-- page `daily_board?order=created_at.asc&limit=200` and rank the rows itself, so a better result from the 201st poster onward never
-- showed, and its ranking used `verified` only to break ties, so an unverified (client-reported, not yet replayed) result could lead.
-- Here verified rows rank ahead of pending ones on every line: a pending row leads only when nothing on that line is verified yet,
-- and it still carries verified = false so the client greys it. The location split counts verified deaths only — `location` is
-- client-reported until the replay confirms it, so an unverified count is a number anyone could inflate.
-- Built on public.daily_board and run as the caller (no security definer): it exposes exactly the columns the view already does —
-- never record or user_id — and grants no access a caller did not already have.
create function public.daily_board_summary(on_day date default (now() at time zone 'utc')::date) returns jsonb
language sql stable set search_path = public as $$
  with kills as (select * from public.daily_board where day = on_day and outcome = 'killed'),
       deaths as (select * from public.daily_board where day = on_day and outcome = 'died')
  select jsonb_build_object(
    'day', on_day,
    'fastest_kill',     (select to_jsonb(k) from kills k  order by k.verified desc, k.ticks asc,  k.created_at asc limit 1),
    'cleanest_kill',    (select to_jsonb(k) from kills k  order by k.verified desc, k.taken asc,  k.created_at asc limit 1),
    'longest_survived', (select to_jsonb(d) from deaths d order by d.verified desc, d.ticks desc, d.created_at asc limit 1),
    'fastest_death',    (select to_jsonb(d) from deaths d order by d.verified desc, d.ticks asc,  d.created_at asc limit 1),
    'where',   (select jsonb_object_agg(w.location, w.n) from (select location, count(*) as n from deaths where verified and location is not null group by location) w),
    'pending', (select count(*) from public.daily_board where day = on_day and not verified)
  )
$$;
revoke all on function public.daily_board_summary(date) from public;
grant execute on function public.daily_board_summary(date) to anon, authenticated;
comment on function public.daily_board_summary(date) is 'The day''s five board headlines over every row, verified rows ranked first, location split over verified deaths, plus the pending count. Public columns only.';
commit;
