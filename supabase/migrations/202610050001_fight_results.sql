begin;
-- ROLLBACK (nothing else depends on these objects): drop function public.report_duel(text, text, text, text, integer, jsonb), public.pit_duel_beaten(), public.pit_ai_standing(), public.fight_results_rate();
--   drop table public.duel_reports, public.fight_results;  Rows are cosmetic wall data, so dropping loses no award, rank or loot.
-- Fight results for the Pit's skull walls (Lead brief docs/briefs/skull-wall/BRIEF.md part A; Dom 2026-10-04).
-- One row per finished fight for a signed-in fighter: kind 'ai' (a legend, key `<opponent>-<rank>`) or 'duel' (key = an opaque per-viewer id of the other player; see report_duel).
-- The opponent's name, level and gear are a snapshot taken at the fight; gear is a small jsonb object of paperdoll ids.
-- Who writes: AI rows are written by the fighter's own client (own user_id, kind 'ai' only, per-user rate cap). They are cosmetic:
-- they feed the wall and nothing else, never awards (awards stay server-checked: server_awards / the verifier). Duel rows are written
-- ONLY by report_duel() below, never by a client insert: each page reports its settled result with the final checkpoint hash, and the
-- two rows are written when both players' reports of one room AGREE (one win and one loss, same hash). A lone client cannot write itself
-- a win. Two accounts colluding in one room could, which only decorates their own wall: these rows are cosmetic and NEVER feed awards,
-- rewards, rank or loot. `room` pairs the two rows and makes the write idempotent. A fighter reads only their own rows.
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
-- Per legend: ranks beaten (ascending), the win/loss/draw totals across all ranks, and `beaten`: true when there is any evidence of a win,
-- including the fighter's older loot (taken/declined provenance and defeats keys, which carry no rank for old takes).
create function public.pit_ai_standing() returns table (opponent text, ranks_beaten smallint[], wins integer, losses integer, draws integer, beaten boolean)
language sql stable security invoker set search_path = '' as $$
  with r as (
    select regexp_replace(opponent_key, '-[0-9]+$', '') opp, substring(opponent_key from '[0-9]+$')::smallint rank, result
    from public.fight_results where kind = 'ai'
  ), loot as (select loot from public.fighter_profiles limit 1),
  l as (
    select p->>'opponent' opp, nullif(p->>'tier', '')::smallint rank from loot, jsonb_each(case when jsonb_typeof(loot.loot->'taken') = 'object' then loot.loot->'taken' else '{}' end) t(k, p)
    union all select p->>'opponent', nullif(p->>'tier', '')::smallint from loot, jsonb_array_elements(case when jsonb_typeof(loot.loot->'declined') = 'array' then loot.loot->'declined' else '[]' end) d(p)
    union all select regexp_replace(k, '-[0-9]+$', ''), nullif(substring(k from '[0-9]+$'), '')::smallint from loot, jsonb_array_elements_text(case when jsonb_typeof(loot.loot->'defeats') = 'array' then loot.loot->'defeats' else '[]' end) d(k)
  ), seen as (select opp, rank from r where result = 'win' union all select opp, rank from l where opp is not null)
  select o.opp, coalesce((select array_agg(distinct s.rank order by s.rank) from seen s where s.opp = o.opp and s.rank is not null), '{}'),
    (select count(*) from r where r.opp = o.opp and r.result = 'win')::integer, (select count(*) from r where r.opp = o.opp and r.result = 'loss')::integer,
    (select count(*) from r where r.opp = o.opp and r.result = 'draw')::integer, exists (select 1 from seen s where s.opp = o.opp)
  from (select opp from r union select opp from l where opp is not null) o order by o.opp
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

-- Duel reports: what each page says about a settled duel. Nobody reads or writes this table directly; report_duel() is the only way in.
create table public.duel_reports (
  room text not null check (room ~ '^[a-z0-9]{8,32}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  result text not null check (result in ('win', 'loss')),
  hash text not null check (hash ~ '^[0-9a-f]{16}$'),
  name text not null check (char_length(name) between 1 and 40 and name !~ '[[:cntrl:]]'),
  level smallint not null check (level between 0 and 1000),
  gear jsonb not null default '{}' check (jsonb_typeof(gear) = 'object' and octet_length(gear::text) <= 1024),
  created_at timestamptz not null default now(),
  primary key (room, user_id)
);
alter table public.duel_reports enable row level security;
revoke all on public.duel_reports from public, anon, authenticated;
create index duel_reports_created on public.duel_reports (created_at);

-- A signed-in page reports its settled duel: its result, the fingerprint of the final checkpoint (both pages compute the same one) and its
-- own name, level and gear as the opponent will see them. When the room's other report arrives and agrees (opposite results, same hash),
-- both fighters get a fight_results row with the OTHER account's name, level and gear and an opaque per-viewer key (md5 of viewer id + opponent id: stable for head-to-head, never the opponent's auth id). A third account naming
-- the same room is refused; a repeat of the same report changes nothing. Returns true when the pair is on record (so a retry is safe).
create function public.report_duel(p_room text, p_result text, p_hash text, p_name text, p_level integer, p_gear jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); peer public.duel_reports%rowtype; mine public.duel_reports%rowtype;
begin
  if me is null then raise exception 'sign in to report a duel' using errcode = 'insufficient_privilege'; end if;
  if (select count(*) from public.duel_reports where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'duel report cap reached' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.duel_reports where room = p_room) >= 2 and not exists (select 1 from public.duel_reports where room = p_room and user_id = me) then
    raise exception 'room already reported' using errcode = 'insufficient_privilege';
  end if;
  insert into public.duel_reports (room, user_id, result, hash, name, level, gear) values (p_room, me, p_result, p_hash, p_name, p_level, coalesce(p_gear, '{}'))
    on conflict (room, user_id) do nothing;
  select * into mine from public.duel_reports where room = p_room and user_id = me;
  select * into peer from public.duel_reports where room = p_room and user_id <> me;
  if not found or peer.hash <> mine.hash or peer.result = mine.result then return false; end if;
  insert into public.fight_results (user_id, kind, opponent_key, opponent_name, opponent_level, opponent_gear, result, room) values
    (me, 'duel', md5(me::text || peer.user_id::text), peer.name, peer.level, peer.gear, mine.result, p_room),
    (peer.user_id, 'duel', md5(peer.user_id::text || me::text), mine.name, mine.level, mine.gear, peer.result, p_room)
    on conflict (user_id, room) where room is not null do nothing;
  return true;
end$$;
revoke all on function public.report_duel(text, text, text, text, integer, jsonb) from public, anon;
grant execute on function public.report_duel(text, text, text, text, integer, jsonb) to authenticated;
commit;
