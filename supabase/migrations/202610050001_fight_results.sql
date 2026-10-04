begin;
-- Fight results for the Pit's skull walls (Lead brief docs/briefs/skull-wall/BRIEF.md part A; Dom 2026-10-04).
-- One row per finished fight for a signed-in fighter: kind 'ai' (a legend, key `<opponent>-<rank>`) or 'duel' (key = the other player's
-- user id). The opponent's name, level and gear are a snapshot taken at the fight; gear is a small jsonb object of paperdoll ids.
-- Who writes: AI rows are written by the fighter's own client (own user_id, kind 'ai' only, per-user rate cap). They are cosmetic:
-- they feed the wall and nothing else, never awards (awards stay server-checked: server_awards / the verifier). Duel rows are written
-- ONLY by the service role (the relay), so no client can grant itself a duel win; `room` pairs the two rows of one duel and makes the
-- write idempotent. A fighter reads only their own rows.
create table public.fight_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ai', 'duel')),
  opponent_key text not null check (char_length(opponent_key) between 1 and 64 and opponent_key !~ '[[:cntrl:]]'),
  opponent_name text not null check (char_length(opponent_name) between 1 and 40 and opponent_name !~ '[[:cntrl:]]'),
  opponent_level smallint not null check (opponent_level between 0 and 1000),
  opponent_gear jsonb not null default '{}' check (jsonb_typeof(opponent_gear) = 'object' and octet_length(opponent_gear::text) <= 1024),
  result text not null check (result in ('win', 'loss', 'draw')),
  room text check (room ~ '^[a-z0-9]{8,32}$'),
  created_at timestamptz not null default now(),
  check (kind = 'ai' or room is not null),
  check (kind = 'duel' or opponent_key ~ '^[a-z0-9_]+-[0-9]{1,3}$')
);
alter table public.fight_results enable row level security;
revoke all on public.fight_results from public, anon, authenticated;
grant select on public.fight_results to authenticated;
grant insert (kind, opponent_key, opponent_name, opponent_level, opponent_gear, result) on public.fight_results to authenticated;
grant all on public.fight_results to service_role;
create policy "own results" on public.fight_results for select to authenticated using (user_id = (select auth.uid()));
create policy "own ai results" on public.fight_results for insert to authenticated with check (user_id = (select auth.uid()) and kind = 'ai');
create index fight_results_user_created on public.fight_results (user_id, created_at desc);
create unique index fight_results_duel_room on public.fight_results (user_id, room) where room is not null;

create function public.fight_results_rate() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'ai' and (select count(*) from public.fight_results where user_id = new.user_id and kind = 'ai' and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'fight results cap reached' using errcode = 'insufficient_privilege';
  end if;
  return new;
end$$;
revoke all on function public.fight_results_rate() from public, anon, authenticated;
create trigger fight_results_rate before insert on public.fight_results for each row execute function public.fight_results_rate();

-- Pit read API. security invoker: the caller's own rows only, through the select policy.
-- Per legend: ranks beaten (ascending) and the win/loss/draw totals across all ranks of that legend.
create function public.pit_ai_standing() returns table (opponent text, ranks_beaten smallint[], wins integer, losses integer, draws integer)
language sql stable security invoker set search_path = '' as $$
  select regexp_replace(opponent_key, '-[0-9]+$', ''),
    coalesce(array_agg(distinct substring(opponent_key from '[0-9]+$')::smallint order by substring(opponent_key from '[0-9]+$')::smallint) filter (where result = 'win'), '{}'),
    (count(*) filter (where result = 'win'))::integer, (count(*) filter (where result = 'loss'))::integer, (count(*) filter (where result = 'draw'))::integer
  from public.fight_results where kind = 'ai' group by 1 order by 1
$$;
-- Players beaten in duels, latest win first, at most 30: name, level and gear from the latest duel against them, plus the head-to-head.
create function public.pit_duel_beaten() returns table (opponent_key text, opponent_name text, opponent_level smallint, opponent_gear jsonb, last_win_at timestamptz, wins integer, losses integer, draws integer)
language sql stable security invoker set search_path = '' as $$
  with h as (
    select opponent_key, (count(*) filter (where result = 'win'))::integer wins, (count(*) filter (where result = 'loss'))::integer losses,
      (count(*) filter (where result = 'draw'))::integer draws, max(created_at) filter (where result = 'win') last_win_at, max(created_at) last_at
    from public.fight_results where kind = 'duel' group by opponent_key
  )
  select h.opponent_key, l.opponent_name, l.opponent_level, l.opponent_gear, h.last_win_at, h.wins, h.losses, h.draws
  from h join lateral (select r.opponent_name, r.opponent_level, r.opponent_gear from public.fight_results r
    where r.kind = 'duel' and r.opponent_key = h.opponent_key order by r.created_at desc limit 1) l on true
  where h.wins > 0 order by h.last_win_at desc limit 30
$$;
revoke all on function public.pit_ai_standing(), public.pit_duel_beaten() from public, anon;
grant execute on function public.pit_ai_standing(), public.pit_duel_beaten() to authenticated;
commit;
