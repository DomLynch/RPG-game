begin;
-- ROLLBACK (nothing else depends on these objects; no reward is paid yet, PVP_REWARDS is false): drop function public.duel_antifarm_state(uuid, uuid), public.duel_count_win(text, uuid, uuid, integer, numeric, integer, integer); drop table public.duel_counted_wins, public.duel_ratings;
-- The anti-farm layer's storage (src/net/duel-antifarm.ts has the rules; Lead brief 2026-10-06, rewards stay OFF): a rating per account and
-- the wins that COUNTED (a verified win, the first over that opponent that UTC day). Written ONLY by the verifier sweep
-- (scripts/verify-duels.mjs, role frankendom_verifier) through duel_count_win(); a client reads its own rating and nothing else, and can write nothing.
-- The day rule is also a unique index, so two sweeps racing cannot both count a rematch. The key is per DIRECTION: (winner, opponent, day),
-- so A beating B and B beating A each count once a day, and a second win by the same winner over the same opponent that day does not.
create table public.duel_ratings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 10000),
  updated_at timestamptz not null default now()
);
create table public.duel_counted_wins (
  id bigint generated always as identity primary key,
  room text not null unique check (room ~ '^[a-z0-9]{8,32}$'),
  winner uuid not null references auth.users (id) on delete cascade,
  opponent uuid not null references auth.users (id) on delete cascade,
  day date not null,
  gain integer not null check (gain between 0 and 1000),
  pay numeric(8, 2) not null default 0 check (pay between 0 and 100000),
  created_at timestamptz not null default now(),
  check (winner <> opponent),
  unique (winner, opponent, day)
);
create index duel_counted_wins_winner_day on public.duel_counted_wins (winner, day);
alter table public.duel_ratings enable row level security;
alter table public.duel_counted_wins enable row level security;
revoke all on public.duel_ratings, public.duel_counted_wins from public, anon, authenticated;
grant select on public.duel_ratings to authenticated;
create policy "own rating" on public.duel_ratings for select to authenticated using (user_id = (select auth.uid()));

-- What the rules need to decide one verified win: both ratings (null when the account has none yet) and the winner's wins that count today (UTC).
create function public.duel_antifarm_state(p_winner uuid, p_loser uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'winner_rating', (select rating from public.duel_ratings where user_id = p_winner),
    'loser_rating', (select rating from public.duel_ratings where user_id = p_loser),
    'wins', coalesce((select jsonb_agg(jsonb_build_object('opponent', opponent, 'at', (extract(epoch from created_at) * 1000)::bigint))
      from public.duel_counted_wins where winner = p_winner and day = (now() at time zone 'utc')::date), '[]'::jsonb))
$$;

-- Count one verified win: false (and nothing changes) when this room already counted or the winner already counted a win over this opponent today.
-- Both accounts must have registered in the room (duel_starts), so even the verifier cannot count a win between accounts that never met.
-- The rating moves by `p_gain` (winner up, loser down) from `p_start` for an account with none, never below `p_floor`.
create function public.duel_count_win(p_room text, p_winner uuid, p_loser uuid, p_gain integer, p_pay numeric, p_start integer, p_floor integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare counted integer;
begin
  if p_winner = p_loser or p_gain not between 0 and 1000 or p_pay not between 0 and 100000 or p_floor not between 1 and 10000 or p_start not between p_floor and 10000 then
    raise exception 'duel_count_win: bad arguments' using errcode = '22023';
  end if;
  if (select count(*) from public.duel_starts s where s.room = p_room and s.user_id in (p_winner, p_loser)) <> 2 then
    raise exception 'duel_count_win: the room does not hold both accounts' using errcode = '22023';
  end if;
  insert into public.duel_counted_wins (room, winner, opponent, day, gain, pay)
    values (p_room, p_winner, p_loser, (now() at time zone 'utc')::date, p_gain, p_pay) on conflict do nothing;
  get diagnostics counted = row_count;
  if counted = 0 then return false; end if;
  insert into public.duel_ratings (user_id, rating) values (p_winner, least(10000, p_start + p_gain))
    on conflict (user_id) do update set rating = least(10000, public.duel_ratings.rating + p_gain), updated_at = now();
  insert into public.duel_ratings (user_id, rating) values (p_loser, greatest(p_floor, p_start - p_gain))
    on conflict (user_id) do update set rating = greatest(p_floor, public.duel_ratings.rating - p_gain), updated_at = now();
  return true;
end$$;
revoke all on function public.duel_antifarm_state(uuid, uuid), public.duel_count_win(text, uuid, uuid, integer, numeric, integer, integer) from public, anon, authenticated;
grant execute on function public.duel_antifarm_state(uuid, uuid), public.duel_count_win(text, uuid, uuid, integer, numeric, integer, integer) to frankendom_verifier;
commit;
