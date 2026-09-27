-- ROLLBACK of 202609230001_server_awards (Lead's hosted order for the claims publish, 2026-09-28). NOT a migration: it lives outside
-- supabase/migrations so no runner applies it. Only for a DB that 0001 itself got wrong; a client bug is a client redeploy, not this.
--
-- It DESTROYS every loot claim and award made since the apply (and the grandfathered seed). It runs ONLY on the owner's explicit word
-- (Dom, typed; a relay does not count), by Deploy, in this order:
--   (a) on the VPS: systemctl stop frankendom-verify-loot.timer      -- no sweep writes during the drop
--   (b) redeploy the previous client release                          -- nothing posts claims (#778's outbox keeps them on PGRST205)
--   (c) this file, as one transaction.
-- A later re-apply of 0001 re-seeds account_seed from fighter_profiles.victory_marks at that moment.
begin;
drop function if exists public.my_standing();
drop function if exists public.standing_of(uuid, bigint);
drop table if exists public.awards;          -- its triggers and policies go with it
drop table if exists public.loot_claims;     -- ditto (loot_claims_rate, loot_claims_verified_one_way, the verifier's policies)
drop table if exists public.account_seed;
drop function if exists public.award_needs_verified_claim();
drop function if exists public.claim_stays_verified();
drop function if exists public.loot_claims_rate();
delete from supabase_migrations.schema_migrations where name = '202609230001_server_awards';
commit;
-- Receipt (read-only): select to_regclass('public.loot_claims'), to_regclass('public.awards'), to_regclass('public.account_seed'),
--   to_regprocedure('public.my_standing()'); expect four nulls, and no 202609230001 row in supabase_migrations.schema_migrations.
