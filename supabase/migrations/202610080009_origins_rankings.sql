begin;
-- ROLLBACK: supabase/down/202610080009_origins_rankings_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE: ONE read function and ONE partial index. No table, existing function, grant or policy is altered.
-- Why (Dom 2026-10-08, the Pit as a town building with a leaderboard stone; Lead's GO on the shape): the stone, the ☰ boards and Web's hub boards read
-- one top-N per board over what is already recorded. The writer calls this, caches each board 60 s and rate-limits the route; no account id leaves here.
--   level  : origins_total_credit (seed + world + Pit CP), the writer turns it into the level (origins/progression/model.ts levelOfCredit)
--   kills  : verified won world fights (origins_events kind 'mob')
--   pvp    : duel_ratings.rating
--   pit    : fighter_profiles.victory_marks (the Pit career)
-- Names: the account's ACTIVE Origins character for level/kills, the Pit display name for pvp/pit. Ties break by name, then by row, so the order is stable.
create index origins_events_won_mob on public.origins_events (account) where kind = 'mob' and payload ->> 'result' = 'won' and payload ->> 'verified' = 'true';
create function public.origins_rankings(p_board text, p_limit int) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n int := least(greatest(coalesce(p_limit, 50), 1), 50); out jsonb;
begin
  if p_board = 'level' then
    select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'value', t.v) order by t.v desc, t.name, t.k), '[]') into out from (
      select coalesce(c.name, 'A wanderer') as name, public.origins_total_credit(k.account) as v, k.account::text as k
      from public.origins_career k left join public.origins_active_character a on a.account = k.account left join public.origins_characters c on c.id = a.character
      order by 2 desc, 1, 3 limit n) t where t.v > 0;
  elsif p_board = 'kills' then
    select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'value', t.v) order by t.v desc, t.name, t.k), '[]') into out from (
      select coalesce(c.name, 'A wanderer') as name, count(*) as v, e.account::text as k
      from public.origins_events e left join public.origins_active_character a on a.account = e.account left join public.origins_characters c on c.id = a.character
      where e.kind = 'mob' and e.payload ->> 'result' = 'won' and e.payload ->> 'verified' = 'true'
      group by e.account, c.name order by 2 desc, 1, 3 limit n) t;
  elsif p_board = 'pvp' then
    select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'value', t.v) order by t.v desc, t.name, t.k), '[]') into out from (
      select coalesce(f.display_name, 'A fighter') as name, r.rating as v, r.user_id::text as k
      from public.duel_ratings r left join public.fighter_profiles f on f.user_id = r.user_id
      order by 2 desc, 1, 3 limit n) t;
  elsif p_board = 'pit' then
    select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'value', t.v) order by t.v desc, t.name, t.k), '[]') into out from (
      select coalesce(f.display_name, 'A fighter') as name, f.victory_marks as v, f.user_id::text as k
      from public.fighter_profiles f where f.victory_marks > 0
      order by 2 desc, 1, 3 limit n) t;
  else
    raise exception 'unknown board %', p_board using errcode = '22023';
  end if;
  return out;
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation (the trap #1639 hit): revoke them, then grant the two writer roles only.
revoke all on function public.origins_rankings(text, int) from public, anon, authenticated;
grant execute on function public.origins_rankings(text, int) to frankendom_origins, frankendom_verifier;
commit;
