begin;
-- Live PvP connection metrics (Duel lane; Lead 2026-09-29: its own table, not perf_beacons, whose caps belong to the fight beacon).
-- One row per side per duel, sent by the client when the duel ends or the page hides. It holds what docs/duel-architecture.md §8 measures:
-- the release revision; the room code (a random id both sides share, so the two rows of one duel pair up); which side; the path the
-- packets took ('direct' WebRTC or the VPS 'relay') and, when direct, the ICE candidate type of the selected pair; frames played;
-- rollbacks a minute, rollback depth p95 and max; stalls a minute; the input delay at the end and at its highest; round trip p50/p95 in
-- ms; desyncs; outcome corrections a minute (a shown impact a rollback changed; not "flips": the privacy check reads "ip" in that name); the browser's user-agent (300 chars at most); server time.
-- What it never holds: no user id, no session, no IP, no intents or record, no free text beyond the user-agent. Nothing reads the request.
-- Abuse bounds as perf_beacons: typed, range-checked columns; anon and authenticated INSERT the listed columns only; a global cap of
-- 60 rows a minute and 5000 a day (per row); rows older than 90 days deleted daily where pg_cron exists (hosted).
create table public.duel_metrics (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  revision text not null check (revision ~ '^[0-9a-f]{7,40}$'),
  room text not null check (room ~ '^[a-z0-9]{8,32}$'),
  side smallint not null check (side in (0, 1)),
  path text not null check (path in ('direct', 'relay')),
  candidate text check (candidate in ('host', 'srflx', 'prflx', 'relay')),
  frames integer not null check (frames between 1 and 1000000),
  rollbacks_per_min real not null check (rollbacks_per_min between 0 and 3600),
  depth_p95 smallint not null check (depth_p95 between 0 and 60),
  max_depth smallint not null check (max_depth between 0 and 60 and max_depth >= depth_p95),
  stalls_per_min real not null check (stalls_per_min between 0 and 3600),
  delay smallint not null check (delay between 0 and 60),
  max_delay smallint not null check (max_delay between 0 and 60 and max_delay >= delay),
  rtt_p50_ms real check (rtt_p50_ms between 0 and 10000),
  rtt_p95_ms real check (rtt_p95_ms between 0 and 10000 and rtt_p95_ms >= rtt_p50_ms),
  desyncs integer not null check (desyncs between 0 and 100000),
  corrections_per_min real check (corrections_per_min between 0 and 3600),
  ua text not null check (char_length(ua) between 1 and 300 and ua !~ '[[:cntrl:]]')
);
alter table public.duel_metrics enable row level security;
revoke all on public.duel_metrics from public, anon, authenticated;
grant insert (revision, room, side, path, candidate, frames, rollbacks_per_min, depth_p95, max_depth, stalls_per_min, delay, max_delay,
  rtt_p50_ms, rtt_p95_ms, desyncs, corrections_per_min, ua) on public.duel_metrics to anon, authenticated;
create policy "anyone sends duel metrics" on public.duel_metrics for insert to anon, authenticated with check (true);
create index duel_metrics_created_at on public.duel_metrics (created_at);

create function public.duel_metrics_rate() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.duel_metrics where created_at > now() - interval '1 minute') >= 60
    or (select count(*) from public.duel_metrics where created_at > now() - interval '1 day') >= 5000 then
    raise exception 'duel metrics cap reached' using errcode = 'insufficient_privilege';
  end if;
  return new;
end$$;
revoke all on function public.duel_metrics_rate() from public, anon, authenticated;
create trigger duel_metrics_rate before insert on public.duel_metrics for each row execute function public.duel_metrics_rate();

create function public.prune_duel_metrics() returns integer language sql security definer set search_path = '' as $$
  with gone as (delete from public.duel_metrics where created_at < now() - interval '90 days' returning 1) select count(*)::integer from gone
$$;
revoke all on function public.prune_duel_metrics() from public, anon, authenticated;
do $$begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('frankendom_duel_metrics_retention', '29 4 * * *', 'select public.prune_duel_metrics()');
  end if;
end$$;
commit;
