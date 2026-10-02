-- Duel health for gate 4 (Backend, 2026-10-02). READ ONLY: one SELECT, no DDL, no grants, nothing applied.
-- Run as the project owner (Supabase SQL editor or the MCP execute_sql); anon/authenticated cannot read duel_metrics.
-- Set the window in `params`. One row per side per duel (src/net/lobby.ts); if a side posted twice (page hid, then ended), its last row counts.
with params as (select timestamptz '2026-10-03 00:00+04' as since, timestamptz 'infinity' as until),
src as (select * from public.duel_metrics),
side as (
  select distinct on (room, side) s.*
  from src s, params p
  where s.created_at >= p.since and s.created_at < p.until
  order by room, side, created_at desc
),
duel as (
  select room,
    count(*) as sides,
    bool_or(path = 'relay') as relayed,
    max(result) filter (where side = 0) as r0,
    max(result) filter (where side = 1) as r1,
    sum(desyncs) as desyncs,
    max(rtt_p95_ms) as rtt_p95,
    max(stalls_per_min) as stalls_per_min,
    max(rollbacks_per_min) as rollbacks_per_min,
    sum(reconnects) as reconnects
  from side group by room
),
judged as (
  select *,
    case
      when sides < 2 then 'one side only'
      when r0 is null or r1 is null then 'no result'
      when (r0, r1) in (('finished', 'finished'), ('no-contest', 'no-contest'),
                        ('forfeit-win', 'forfeit-loss'), ('forfeit-loss', 'forfeit-win')) then 'agree'
      else 'disagree'
    end as agreement
  from duel
)
select
  (select count(*) from judged) as duels,
  (select count(*) from judged where sides = 2) as both_sides_reported,
  (select count(*) from judged where sides = 1) as one_side_only,
  (select count(*) from judged where not relayed) as direct_duels,
  (select count(*) from judged where relayed) as relayed_duels,
  (select jsonb_object_agg(c, n) from (select coalesce(candidate, 'none') c, count(*) n from side group by 1) x) as candidates,
  (select jsonb_object_agg(r, n) from (select coalesce(result, 'null') r, count(*) n from side group by 1) x) as results_by_side,
  (select count(*) from judged where agreement = 'agree') as results_agree,
  (select count(*) from judged where agreement = 'disagree') as results_disagree,
  (select count(*) from judged where agreement = 'no result') as results_missing,
  (select count(*) from judged where 'forfeit-win' in (r0, r1) or 'forfeit-loss' in (r0, r1)) as duels_forfeited,
  (select count(*) from judged where desyncs > 0) as duels_with_desync,
  (select percentile_cont(0.5) within group (order by rtt_p95) from judged) as median_duel_rtt_p95_ms,
  (select max(stalls_per_min) from judged) as worst_stalls_per_min,
  (select max(rollbacks_per_min) from judged) as worst_rollbacks_per_min,
  (select count(*) from judged where reconnects > 0) as duels_with_reconnects,
  (select sum(reconnects) from judged) as reconnects_total,
  (select jsonb_object_agg(d, n) from (select case when ua ~ 'iPhone|iPad' then 'ios' when ua ~ 'Android' then 'android' else 'desktop' end d, count(*) n from side group by 1) x) as devices,
  (select jsonb_agg(jsonb_build_object('room', room, 'r0', r0, 'r1', r1)) from judged where agreement = 'disagree') as disagreeing_rooms;
