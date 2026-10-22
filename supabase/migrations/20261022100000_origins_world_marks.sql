-- ROLLBACK: supabase/down/20261022100000_origins_world_marks_down.sql (restores standing_of exactly as 202609230001 made it, then drops the function and both tables).
-- CLASS 2, APPLY-READY only (Backend's review; Dom applies on prod, Lead's ruling is on the PR): one function REPLACED (public.standing_of, same signature, same return shape, same grants) and two new
-- tables plus one new definer function. No existing table or column is altered.
-- Why (docs/specs/origins/pit-live-zone.md, Lead's Dungeon design; Lead ruling 2026-10-22 "B"): a Dungeon gate-boss kill is a ladder win. A mark is a whole ladder step, so it must be exact and
-- ORDER-FREE: it is decided on the whole damage ledger of the kill once its join window has closed (ModernUO decides who qualified at death, relative to the top damager), never on who reported first.
--   origins_world_marks          one row per (account, layer, instance, generation) = one mark per account per spawn kill. RLS on, no policy, no grant: reachable only through the definer functions.
--   origins_world_marks_settled  one row per incarnation already settled, so a settle is idempotent and never rescans it.
--   origins_world_marks_settle(p_wait_s, p_of_top, p_cap, p_per_hour, p_instances, p_limit)
--        the writer calls it once a minute. For up to p_limit unsettled incarnations of the spawns in p_instances (the roster fighters, flagged in their spawn rows; any other creature is no ladder win)
--        whose FIRST ledger row is older than p_wait_s (the join window plus a grace, both rows of server-rules.json): the top damage is the largest ledger damage of the incarnation; every account whose
--        own damage is at least p_of_top (the row `worldMarks.ofTop`, 0.5) of the top earns ONE mark, while that account's TOTAL standing marks (seed + verified claims + world marks) are below p_cap
--        (the beta cut, betaMarks: world marks alone can never lift a player past it) AND it has earned fewer than p_per_hour world marks in the last hour (the row `worldMarks.perHour`, a brake
--        on farming a respawning roster). Returns the marks written.
--   standing_of  gains the second source: + the account's world marks. With before_claim, only marks created BEFORE that claim count, the same earlier-than rule as claims.
-- Unverified damage is 0 in the ledger (the kill_report path writes damage 0 when the record did not verify), so it never qualifies. The cap is checked per account under an advisory lock; a verified claim
-- landing in the same instant can overshoot it by one at worst (the client shows betaMarks anyway).
begin;

create table public.origins_world_marks (
  user_id uuid not null,
  layer int not null check (layer >= 1),
  instance text not null check (instance ~ '^[a-z0-9._:-]{1,96}$'),
  generation int not null check (generation >= 0),
  damage numeric not null check (damage > 0),
  top numeric not null check (top >= damage),
  created_at timestamptz not null default now(),
  primary key (user_id, layer, instance, generation)
);
create index origins_world_marks_user on public.origins_world_marks (user_id, created_at);
alter table public.origins_world_marks enable row level security;
revoke all on public.origins_world_marks from public, anon, authenticated;

create table public.origins_world_marks_settled (
  layer int not null check (layer >= 1),
  instance text not null check (instance ~ '^[a-z0-9._:-]{1,96}$'),
  generation int not null check (generation >= 0),
  settled_at timestamptz not null default now(),
  primary key (layer, instance, generation)
);
alter table public.origins_world_marks_settled enable row level security;
revoke all on public.origins_world_marks_settled from public, anon, authenticated;

create or replace function public.standing_of(account uuid, before_claim bigint) returns table (marks integer, owned jsonb) language sql stable security definer set search_path = '' as $$
  with earlier as (
    select c.id from public.loot_claims c
    where c.user_id = account and c.verified
      and (before_claim is null or (c.created_at, c.id) < (select x.created_at, x.id from public.loot_claims x where x.id = before_claim)))
  select coalesce((select s.marks from public.account_seed s where s.user_id = account), 0) + (select count(*) from earlier)::integer
           + (select count(*) from public.origins_world_marks w
              where w.user_id = account and (before_claim is null or w.created_at < (select x.created_at from public.loot_claims x where x.id = before_claim)))::integer,
         (select coalesce(jsonb_agg(p order by p), '[]'::jsonb) from (
            select jsonb_array_elements_text(s.owned) as p from public.account_seed s where s.user_id = account
            union
            select a.piece from public.awards a join earlier e on e.id = a.claim_id) pieces)
$$;

create function public.origins_world_marks_settle(p_wait_s int, p_of_top numeric, p_cap int, p_per_hour int, p_instances text[], p_limit int) returns integer language plpgsql security definer set search_path = '' as $$
declare inc record; r record; have integer; recent integer; written integer := 0;
begin
  if p_wait_s is null or p_wait_s < 0 or p_of_top is null or p_of_top <= 0 or p_of_top > 1 or p_cap is null or p_cap < 0 or p_per_hour is null or p_per_hour < 1
     or p_instances is null or p_limit is null or p_limit < 1 then
    raise exception 'bad settle arguments' using errcode = 'O0002'; end if;
  for inc in
    select d.layer, d.instance, d.generation
    from public.origins_spawn_damage d
    where d.instance = any (p_instances)   -- only the spawns the writer flags as roster fighters (the spawn row's data); every other creature's kill is no ladder win
      and not exists (select 1 from public.origins_world_marks_settled s where s.layer = d.layer and s.instance = d.instance and s.generation = d.generation)
    group by d.layer, d.instance, d.generation
    having min(d.at) + make_interval(secs => p_wait_s) < now()
    order by min(d.at)
    limit p_limit
  loop
    insert into public.origins_world_marks_settled (layer, instance, generation) values (inc.layer, inc.instance, inc.generation) on conflict do nothing;
    if not found then continue; end if;   -- another settle got there first
    for r in
      with per as (
        select d.account, max(d.damage) as damage from public.origins_spawn_damage d
        where d.layer = inc.layer and d.instance = inc.instance and d.generation = inc.generation and d.damage > 0 group by d.account),
      top as (select max(per.damage) as t from per)
      select per.account, per.damage, top.t from per, top where top.t is not null and per.damage >= p_of_top * top.t
    loop
      perform pg_advisory_xact_lock(hashtextextended(r.account::text, 0));
      select s.marks into have from public.standing_of(r.account, null) s;
      select count(*) into recent from public.origins_world_marks w where w.user_id = r.account and w.created_at > now() - interval '1 hour';
      if have < p_cap and recent < p_per_hour then
        insert into public.origins_world_marks (user_id, layer, instance, generation, damage, top) values (r.account, inc.layer, inc.instance, inc.generation, r.damage, r.t) on conflict do nothing;
        if found then written := written + 1; end if;
      end if;
    end loop;
  end loop;
  return written;
end $$;

revoke all on function public.origins_world_marks_settle(int, numeric, int, int, text[], int) from public, anon, authenticated;
grant execute on function public.origins_world_marks_settle(int, numeric, int, int, text[], int) to frankendom_origins;

comment on table public.origins_world_marks is 'One ladder mark per account per world-boss kill (spawn incarnation), settled by origins_world_marks_settle on the whole damage ledger. Read through standing_of only.';
commit;
