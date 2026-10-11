begin;
-- Class 1 (additive only: four new tables/functions, no change to any existing object or row). Core slice 2b, ONE CAREER SERVICE (Lead 2026-10-11).
-- ROLLBACK: supabase/down/202610110019_career_service_rows_down.sql (drops only what this file creates; the rows in them are cosmetic or derivable).
--  * pit_ladder: the Pit ladder as a data row (level 1..50 -> title, numeral, label). The rule stays in src/core/career-ladder.ts (level = 1 + wins); a test pins these rows to rankFor, so the table cannot drift from the code. Public read, no client write.
--  * scorecard_rows(): the per-opponent scorecard as a READ of fight_results (kind 'ai', the caller's own rows through the select policy) joined to scorecard_notes. Nothing is stored twice.
--  * scorecard_notes: the only scorecard facts fight_results does not hold: walk-aways ("left") and the autopsy lines of the last fight. Cosmetic, own-row, never feeds awards, like fight_results.
--  * control_trials: the control-trial tally (src/trial.ts) per fighter, cosmetic debug numbers, own-row.
--  * leaderboards(): a READ of duel_ratings and fight_results (duel rows only: those are written by report_duel/settle_forfeits after both players agree; AI rows are client-written, so they never rank anyone). The daily board is already public in daily_board and is read there.
create table public.pit_ladder (
  level smallint primary key check (level between 1 and 50),
  title text not null,
  numeral text not null check (numeral in ('I', 'II', 'III', 'IV', 'V')),
  label text not null unique
);
insert into public.pit_ladder (level, title, numeral, label) values
  (1, 'Recruit', 'I', 'Recruit I'),
  (2, 'Recruit', 'II', 'Recruit II'),
  (3, 'Recruit', 'III', 'Recruit III'),
  (4, 'Recruit', 'IV', 'Recruit IV'),
  (5, 'Recruit', 'V', 'Recruit V'),
  (6, 'Legionary', 'I', 'Legionary I'),
  (7, 'Legionary', 'II', 'Legionary II'),
  (8, 'Legionary', 'III', 'Legionary III'),
  (9, 'Legionary', 'IV', 'Legionary IV'),
  (10, 'Legionary', 'V', 'Legionary V'),
  (11, 'Gladiator', 'I', 'Gladiator I'),
  (12, 'Gladiator', 'II', 'Gladiator II'),
  (13, 'Gladiator', 'III', 'Gladiator III'),
  (14, 'Gladiator', 'IV', 'Gladiator IV'),
  (15, 'Gladiator', 'V', 'Gladiator V'),
  (16, 'Veteran', 'I', 'Veteran I'),
  (17, 'Veteran', 'II', 'Veteran II'),
  (18, 'Veteran', 'III', 'Veteran III'),
  (19, 'Veteran', 'IV', 'Veteran IV'),
  (20, 'Veteran', 'V', 'Veteran V'),
  (21, 'Champion', 'I', 'Champion I'),
  (22, 'Champion', 'II', 'Champion II'),
  (23, 'Champion', 'III', 'Champion III'),
  (24, 'Champion', 'IV', 'Champion IV'),
  (25, 'Champion', 'V', 'Champion V'),
  (26, 'Praetorian', 'I', 'Praetorian I'),
  (27, 'Praetorian', 'II', 'Praetorian II'),
  (28, 'Praetorian', 'III', 'Praetorian III'),
  (29, 'Praetorian', 'IV', 'Praetorian IV'),
  (30, 'Praetorian', 'V', 'Praetorian V'),
  (31, 'Master', 'I', 'Master I'),
  (32, 'Master', 'II', 'Master II'),
  (33, 'Master', 'III', 'Master III'),
  (34, 'Master', 'IV', 'Master IV'),
  (35, 'Master', 'V', 'Master V'),
  (36, 'Primus', 'I', 'Primus I'),
  (37, 'Primus', 'II', 'Primus II'),
  (38, 'Primus', 'III', 'Primus III'),
  (39, 'Primus', 'IV', 'Primus IV'),
  (40, 'Primus', 'V', 'Primus V'),
  (41, 'Invictus', 'I', 'Invictus I'),
  (42, 'Invictus', 'II', 'Invictus II'),
  (43, 'Invictus', 'III', 'Invictus III'),
  (44, 'Invictus', 'IV', 'Invictus IV'),
  (45, 'Invictus', 'V', 'Invictus V'),
  (46, 'Origin', 'I', 'Origin I'),
  (47, 'Origin', 'II', 'Origin II'),
  (48, 'Origin', 'III', 'Origin III'),
  (49, 'Origin', 'IV', 'Origin IV'),
  (50, 'Origin', 'V', 'Origin V');
alter table public.pit_ladder enable row level security;
revoke all on public.pit_ladder from public, anon, authenticated;
grant select on public.pit_ladder to anon, authenticated;
create policy "the ladder is public" on public.pit_ladder for select to anon, authenticated using (true);

create table public.scorecard_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opponent text not null check (opponent ~ '^[a-z0-9_]{1,32}$'),
  left_count integer not null default 0 check (left_count between 0 and 1000000),
  last text[] not null default '{}' check (cardinality(last) <= 2 and array_to_string(last, '') !~ '[[:cntrl:]]' and octet_length(array_to_string(last, '')) <= 400),
  primary key (user_id, opponent)
);
alter table public.scorecard_notes enable row level security;
revoke all on public.scorecard_notes from public, anon, authenticated;
grant select on public.scorecard_notes to authenticated;
grant insert (opponent, left_count, last) on public.scorecard_notes to authenticated;
grant update (left_count, last) on public.scorecard_notes to authenticated;
create policy "own notes read" on public.scorecard_notes for select to authenticated using (user_id = (select auth.uid()));
create policy "own notes insert" on public.scorecard_notes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own notes update" on public.scorecard_notes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- One row per computer legend fought (key `<opponent>-<rank>`, ranks folded): fights = every result, losses and the walk-aways inside them as in src/scorecard.ts. Invoker: the caller's own rows only.
create function public.scorecard_rows() returns table (opponent text, fights integer, wins integer, losses integer, draws integer, left_count integer, last text[])
language sql stable security invoker set search_path = '' as $$
  with r as (select regexp_replace(opponent_key, '-[0-9]+$', '') opp, result from public.fight_results where kind = 'ai')
  select o.opp, (select count(*) from r where r.opp = o.opp)::integer, (select count(*) from r where r.opp = o.opp and r.result = 'win')::integer,
    (select count(*) from r where r.opp = o.opp and r.result = 'loss')::integer, (select count(*) from r where r.opp = o.opp and r.result = 'draw')::integer,
    coalesce(n.left_count, 0), coalesce(n.last, '{}'::text[])
  from (select opp from r union select opponent from public.scorecard_notes) o
  left join public.scorecard_notes n on n.opponent = o.opp order by o.opp
$$;
revoke all on function public.scorecard_rows() from public, anon;
grant execute on function public.scorecard_rows() to authenticated;

create table public.control_trials (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  fights integer not null default 0 check (fights between 0 and 100000000),
  wins integer not null default 0 check (wins between 0 and 100000000),
  rematches integer not null default 0 check (rematches between 0 and 100000000),
  ticks bigint not null default 0 check (ticks between 0 and 100000000000),
  dealt bigint not null default 0 check (dealt between 0 and 100000000000),
  taken bigint not null default 0 check (taken between 0 and 100000000000),
  active_ms bigint not null default 0 check (active_ms between 0 and 100000000000),
  updated_at timestamptz not null default now(),
  check (wins <= fights)
);
alter table public.control_trials enable row level security;
revoke all on public.control_trials from public, anon, authenticated;
grant select on public.control_trials to authenticated;
grant insert (fights, wins, rematches, ticks, dealt, taken, active_ms) on public.control_trials to authenticated;
grant update (fights, wins, rematches, ticks, dealt, taken, active_ms, updated_at) on public.control_trials to authenticated;
create policy "own trial read" on public.control_trials for select to authenticated using (user_id = (select auth.uid()));
create policy "own trial insert" on public.control_trials for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own trial update" on public.control_trials for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The boards, top p_limit (1..50) each, named fighters only (a fighter without a profile has no name to show). 'duel_rating' reads duel_ratings; 'duel_wins' counts agreed duel wins in fight_results.
-- Definer: both tables are own-row to a client. Exposes the display name (already public in daily_board) and the number, never a user id.
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
comment on table public.pit_ladder is 'The Pit ladder as data (level -> title and numeral); pinned to src/core/career-ladder.ts rankFor by a test.';
commit;
