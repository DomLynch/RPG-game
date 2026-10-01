begin;
-- Post-beta tidy-up (Backend security pass 2026-10-01, P1 + P2; docs/briefs/backend/security-pass-2026-10-01.md). Same rules, same
-- meaning, faster: Supabase's advisor (auth_rls_initplan) found five policies calling auth.uid() once PER ROW; wrapped in a scalar
-- subquery it is evaluated once per statement. `alter policy` keeps each policy's name, command and roles; only the expression changes.
-- No grant changes, no data touched.
alter policy "a fighter reads his own awards" on public.awards
  using (exists (select 1 from public.loot_claims c where c.id = awards.claim_id and c.user_id = (select auth.uid())));
alter policy "a fighter posts his own result, today, once" on public.daily_results
  with check ((select auth.uid()) = user_id and day = (now() at time zone 'utc')::date);
alter policy "a fighter stores his own, thirty an hour" on public.fight_records
  with check ((select auth.uid()) = user_id and public.fight_records_recent() < 30);
alter policy "a fighter claims his own wins" on public.loot_claims
  with check (user_id = (select auth.uid()) and not verified);
alter policy "a fighter reads his own claims" on public.loot_claims
  using (user_id = (select auth.uid()));
-- P2 (advisor unindexed_foreign_keys): the primary key (day, user_id) leads with day, so a per-account lookup or an account deletion
-- (on delete cascade) scanned the table.
create index daily_results_user_id on public.daily_results (user_id);
commit;
-- Rollback (as owner, one transaction): the five expressions back to bare auth.uid(), and the index dropped:
--   begin;
--   alter policy "a fighter reads his own awards" on public.awards using (exists (select 1 from public.loot_claims c where c.id = awards.claim_id and c.user_id = auth.uid()));
--   alter policy "a fighter posts his own result, today, once" on public.daily_results with check (auth.uid() = user_id and day = (now() at time zone 'utc')::date);
--   alter policy "a fighter stores his own, thirty an hour" on public.fight_records with check (auth.uid() = user_id and public.fight_records_recent() < 30);
--   alter policy "a fighter claims his own wins" on public.loot_claims with check (user_id = auth.uid() and not verified);
--   alter policy "a fighter reads his own claims" on public.loot_claims using (user_id = auth.uid());
--   drop index public.daily_results_user_id;
--   delete from supabase_migrations.schema_migrations where name = '202610040001_rls_initplan';
--   commit;
