-- The daily warden's server-side replay verifier (scripts/verify-daily.mjs) runs on the VPS as this role: it can read the pending
-- daily results, ask the day's seed, and flip `verified` — nothing else. The password is set out of band on the hosted database
-- (`alter role frankendom_verifier password '…'`) and lives only in the VPS unit's environment file.
-- A row the sweep has looked at, verified or refused: refused rows leave the sweep's page (they stay grey) instead of being
-- replayed on every tick; `verify-daily.mjs --recheck` (after a rules change) sweeps them again.
alter table public.daily_results add column checked_at timestamptz;
create role frankendom_verifier login;
grant usage on schema public to frankendom_verifier;
grant select (day, user_id, opponent, weapon, outcome, ticks, record, verified, checked_at, created_at) on public.daily_results to frankendom_verifier;
grant update (verified, checked_at) on public.daily_results to frankendom_verifier;
grant execute on function public.daily_fight(date) to frankendom_verifier;
-- RLS is on for daily_results (0003): the role needs its own policies, scoped to the sweep.
create policy "the verifier reads every result" on public.daily_results for select to frankendom_verifier using (true);
create policy "the verifier marks results verified" on public.daily_results for update to frankendom_verifier using (true) with check (true);
