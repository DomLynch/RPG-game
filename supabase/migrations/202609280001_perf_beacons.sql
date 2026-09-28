begin;
-- Anonymous per-fight performance beacons (Strategy ruling 2026-09-28, via Lead): how the game runs on phones other than the one we
-- measure. One row per fight, sent by the client at fight end or pagehide, never on the frame. Our own store, no third party.
--
-- What a row holds, and nothing else (column names agreed with Web): the release revision; the fight's frame rate (median and 5th
-- percentile), playable frames, playable seconds and frames over 16.7 ms; seconds from navigation to the first playable frame (first
-- fight of a page load only); the render ratio, the ratio before an automatic drop and any pixel-ratio override; triangles and draw
-- calls; the graphics tier and whether a rank look is on; the browser's user-agent string (300 chars at most), the screen as
-- '<css w>x<css h>@<pixel ratio>', the CPU cores and memory (GB) the browser reports; the median requestAnimationFrame interval (ms)
-- and whether the whole fight ran at a ~30 Hz cadence (iOS Low Power Mode caps rAF at 30 Hz; Strategy, 2026-09-28); and the server's
-- insert time.
-- What it never holds: no user id, no session, no IP address, no record, no free text beyond the user-agent. No column, default or
-- trigger reads the request (no auth.uid(), no inet_client_addr(), no request.headers). Supabase's own API gateway logs every request,
-- this one included, with its client IP for that platform's log retention, exactly as for every other call the game already makes;
-- those logs are not this table and nothing here copies from them.
--
-- Abuse bounds: every column is typed and range-checked, so a row is at most ~0.6 KB; anon and authenticated may INSERT the listed
-- columns only (no select, update or delete; id and created_at are the server's); a global cap of 120 rows a minute and 20000 a day
-- (per row, so one bulk insert cannot pass it); rows older than 90 days are deleted daily where pg_cron exists (hosted).
create table public.perf_beacons (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  revision text not null check (revision ~ '^[0-9a-f]{7,40}$'),
  fps_p50 smallint not null check (fps_p50 between 0 and 240),
  fps_p5 smallint not null check (fps_p5 between 0 and 240 and fps_p5 <= fps_p50),
  frames integer not null check (frames between 1 and 1000000),
  fight_s real not null check (fight_s between 0 and 3600),
  dropped integer not null check (dropped between 0 and 1000000 and dropped <= frames),
  first_fight_s real check (first_fight_s between 0 and 600),
  render_ratio real not null check (render_ratio between 0.1 and 8),
  lowered_from real check (lowered_from between 0.1 and 8 and lowered_from > render_ratio),
  dpr_override real check (dpr_override between 0.1 and 8),
  tris integer not null check (tris between 0 and 20000000),
  draws integer not null check (draws between 0 and 100000),
  gfx_tier text not null check (gfx_tier in ('phone', 'full')),
  look_on boolean not null,
  ua text not null check (char_length(ua) between 1 and 300 and ua !~ '[[:cntrl:]]'),
  screen text not null check (screen ~ '^[0-9]{1,5}x[0-9]{1,5}@[0-9]{1,2}(\.[0-9]{1,3})?$'),
  cores smallint check (cores between 1 and 1024),
  memory_gb real check (memory_gb between 0.1 and 1024),
  raf_ms real check (raf_ms between 5 and 1000),
  raf_capped boolean not null
);
alter table public.perf_beacons enable row level security;
revoke all on public.perf_beacons from public, anon, authenticated;
grant insert (revision, fps_p50, fps_p5, frames, fight_s, dropped, first_fight_s, render_ratio, lowered_from, dpr_override, tris, draws,
  gfx_tier, look_on, ua, screen, cores, memory_gb, raf_ms, raf_capped) on public.perf_beacons to anon, authenticated;
create policy "anyone sends a beacon" on public.perf_beacons for insert to anon, authenticated with check (true);
create index perf_beacons_created_at on public.perf_beacons (created_at);

-- The caps, per row: a BEFORE INSERT row trigger sees rows the same statement already inserted (see loot_claims_rate, 202609230001).
create function public.perf_beacons_rate() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.perf_beacons where created_at > now() - interval '1 minute') >= 120
    or (select count(*) from public.perf_beacons where created_at > now() - interval '1 day') >= 20000 then
    raise exception 'perf beacon cap reached' using errcode = 'insufficient_privilege';
  end if;
  return new;
end$$;
revoke all on function public.perf_beacons_rate() from public, anon, authenticated;
create trigger perf_beacons_rate before insert on public.perf_beacons for each row execute function public.perf_beacons_rate();

-- Retention: 90 days.
create function public.prune_perf_beacons() returns integer language sql security definer set search_path = '' as $$
  with gone as (delete from public.perf_beacons where created_at < now() - interval '90 days' returning 1) select count(*)::integer from gone
$$;
revoke all on function public.prune_perf_beacons() from public, anon, authenticated;
do $$begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('frankendom_perf_beacon_retention', '23 4 * * *', 'select public.prune_perf_beacons()');
  end if;
end$$;

-- The Auditer's daily device spread: one row per day × device family × graphics tier. Read with the service role (MCP / SQL editor);
-- no client role can read it. security_invoker, so it never reads past the caller's own rights.
create view public.perf_device_spread with (security_invoker = true) as
select (created_at at time zone 'UTC')::date as day,
  case when ua ~ 'iPhone' then 'iPhone' when ua ~ 'iPad' then 'iPad' when ua ~ 'Android' then 'Android'
       when ua ~ 'Macintosh' then 'Mac' when ua ~ 'Windows' then 'Windows' when ua ~ 'Linux' then 'Linux' else 'other' end as device,
  gfx_tier,
  count(*) as fights,
  percentile_cont(0.5) within group (order by fps_p50) as fps_p50_median,
  percentile_cont(0.5) within group (order by fps_p5) as fps_p5_median,
  min(fps_p5) as fps_p5_worst,
  round(avg(dropped::numeric / frames), 4) as dropped_share,
  round(avg((lowered_from is not null)::int), 3) as lowered_share,
  round(avg(raf_capped::int), 3) as raf_capped_share,
  percentile_cont(0.5) within group (order by raf_ms) as raf_ms_median,
  percentile_cont(0.5) within group (order by first_fight_s) as first_fight_s_median,
  percentile_cont(0.5) within group (order by render_ratio) as render_ratio_median,
  count(distinct revision) as revisions
from public.perf_beacons
group by 1, 2, 3;
revoke all on public.perf_device_spread from public, anon, authenticated;
commit;
