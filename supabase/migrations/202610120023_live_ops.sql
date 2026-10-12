begin;
-- Class 1 (additive only: two new tables and one function, no change to any existing object or row). Top-30 item 28, live-ops rows (Lead 2026-10-12, plan #2408).
-- ROLLBACK: supabase/down/202610120023_live_ops_down.sql (drops only what this file creates; a missing table makes the writer run on its defaults: no events, every switch on).
--  * origins_live_events: scheduled events. `cron` is five UTC fields (minute hour day-of-month month day-of-week); an event is ACTIVE for `length_min` minutes from every minute the cron matches.
--    `kind` and `params` are free: the consumer of a kind validates its own params (open set, no enum to migrate when a kind is added). `enabled` pauses an event without deleting it.
--  * origins_switches: feature kill switches, one row per key. A key with no row is ON; a row with enabled = false is OFF. Keys are free text; `op:<name>` switches a writer op off (503) with no restart.
--  * origins_live_ops(): both tables as one jsonb, read by the writer once a minute (the AzerothCore game_event pattern: one table, one periodic tick). Operators change rows in the dashboard SQL editor.
create table public.origins_live_events (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_.:-]{0,63}$'),
  cron text not null check (length(cron) between 9 and 100),
  length_min integer not null check (length_min between 1 and 10080),
  kind text not null check (kind ~ '^[a-z0-9][a-z0-9_.:-]{0,63}$'),
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.origins_switches (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_.:-]{0,63}$'),
  enabled boolean not null,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.origins_live_events enable row level security;
alter table public.origins_switches enable row level security;
revoke all on public.origins_live_events, public.origins_switches from public, anon, authenticated;

create function public.origins_live_ops() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cron', cron, 'lengthMin', length_min, 'kind', kind, 'params', params, 'enabled', enabled) order by id) from public.origins_live_events), '[]'::jsonb),
    'switches', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'enabled', enabled) order by key) from public.origins_switches), '[]'::jsonb));
$$;
revoke all on function public.origins_live_ops() from public, anon, authenticated;
grant execute on function public.origins_live_ops() to frankendom_origins;
commit;
