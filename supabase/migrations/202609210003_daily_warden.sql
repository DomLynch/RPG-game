begin;
-- The daily warden (beta plan brief 4; Strategy 2026-09-21). One fight a day for everyone: the same opponent and warden seed, drawn from
-- the UTC date and a server secret nobody sees. A signed-in fighter posts one result a day (the fight record, src/record.ts; a server
-- replay verifies it before it counts, so rows start unverified); guests play but do not post. No marks come from it. Reads are public;
-- no client ever updates or deletes a row. Brief 3's record shape is reused as is.

-- The secret behind the day's seed: no client can read it (RLS on, no policies, no grants); only the definer function below does.
create table public.daily_secret (id boolean primary key default true check (id), secret text not null);
alter table public.daily_secret enable row level security;
revoke all on public.daily_secret from anon, authenticated;
insert into public.daily_secret (secret) values (encode(gen_random_bytes(32), 'hex'));

-- Today's fight: the day, its number (days since the daily opened; the client rotates the live ladder by it) and a 32-bit seed.
-- Anyone may ask for today or an earlier day (the verifier replays past rows); a future day is refused so a client cannot fetch
-- and rehearse tomorrow's one-attempt fight before it opens. The answer is the same for everyone until midnight UTC.
create or replace function public.daily_fight(on_day date default (now() at time zone 'utc')::date)
returns table (day date, number integer, seed integer) language sql security definer stable set search_path = public as $$
  select on_day, (on_day - date '2026-09-22')::integer,
         ('x' || substr(md5(on_day::text || (select secret from public.daily_secret)), 1, 8))::bit(32)::integer
  where on_day <= (now() at time zone 'utc')::date
$$;
revoke all on function public.daily_fight(date) from public;
grant execute on function public.daily_fight(date) to anon, authenticated;

-- One result per fighter per day (the primary key is the "insert own once"); the day must be today (UTC) so a stale client cannot post yesterday.
create table public.daily_results (
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  number integer not null,
  opponent text not null check (char_length(opponent) between 1 and 32),
  weapon text not null check (char_length(weapon) between 1 and 32),
  outcome text not null check (outcome in ('killed', 'died', 'draw', 'abandoned')),
  ticks integer not null check (ticks between 0 and 100000),
  location text check (location in ('head', 'torso', 'legs')),           -- where the killing blow landed
  taken integer not null default 0 check (taken between 0 and 1000),       -- blows taken (client-reported until the replay verifies)
  record text not null check (octet_length(record) <= 16384 and record ~ '^[A-Za-z0-9_-]+$'),
  verified boolean not null default false,                                 -- set by the server replay (Dev/Deploy's verifier), never by a client
  created_at timestamptz not null default now(),
  primary key (day, user_id),
  check (number = (day - date '2026-09-22'))                               -- a client cannot post a day/number pair that don't match
);
create index daily_results_day_ticks on public.daily_results (day, outcome, ticks);
alter table public.daily_results enable row level security;
create policy "the day's board is public" on public.daily_results for select to anon, authenticated using (true);
create policy "a fighter posts his own result, today, once" on public.daily_results for insert to authenticated
  with check (auth.uid() = user_id and day = (now() at time zone 'utc')::date);
-- Column-level, not the whole table: user_id and record are the day's input stream (the solution to a one-attempt fight) and stay
-- out of a direct REST select even though the row itself is public via the policy above; daily_board (below) never carries them either.
grant select (day, number, opponent, weapon, outcome, ticks, location, taken, verified, created_at) on public.daily_results to anon, authenticated;
grant insert (day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record) on public.daily_results to authenticated;

-- The board as the client reads it: the day's rows with the poster's chosen display name (the board is public by intent), never the record.
create view public.daily_board as
  select r.day, r.number, r.opponent, r.weapon, r.outcome, r.ticks, r.location, r.taken, r.verified, r.created_at, p.display_name
  from public.daily_results r left join public.fighter_profiles p on p.user_id = r.user_id;
grant select on public.daily_board to anon, authenticated;
comment on table public.daily_results is 'Daily warden results (beta): one per fighter per UTC day, public read, owner-only insert, verified by a server replay before it counts. No marks.';
commit;
