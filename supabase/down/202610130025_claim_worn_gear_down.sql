begin;
-- Undoes 202610130025_claim_worn_gear.sql. The sweeps then read no frozen gear (a geared record is refused).
drop trigger if exists loot_claims_freeze_worn_gear on public.loot_claims;
drop trigger if exists daily_results_freeze_worn_gear on public.daily_results;
drop function if exists public.freeze_worn_gear();
alter table public.loot_claims drop column if exists worn_gear;
alter table public.daily_results drop column if exists worn_gear;
commit;
