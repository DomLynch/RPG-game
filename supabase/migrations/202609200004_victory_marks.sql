begin;
-- Beta career marks (owner 2026-09-20): the device's won-duel count travels with the cloud save so a signed-in fighter keeps rank
-- across devices. Client-reported and bounded; never rank, result or unlock authority for anything competitive (GAME_SPEC:
-- server-owned Season 1 results remain a separate deliverable).
alter table public.fighter_profiles add column victory_marks integer not null default 0 check (victory_marks between 0 and 100000);
grant insert (victory_marks) on public.fighter_profiles to authenticated;
grant update (victory_marks) on public.fighter_profiles to authenticated;
comment on table public.fighter_profiles is 'Account-owned practice settings plus a client-reported career mark count (beta). No rank, result or unlock authority for competitive play.';
commit;
