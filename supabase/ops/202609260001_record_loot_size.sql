-- Record 202609260001_loot_size in the hosted migration history (Lead, 2026-09-26). NOT a migration: it lives outside
-- supabase/migrations so no runner applies it; Deploy runs it once, on Lead's relay, so the hosted map matches trunk.
-- Why: the owner applied the file's two statements in the SQL editor on 2026-09-26 (~22:1x Dubai = ~18:1x UTC), which runs SQL but
-- writes no schema_migrations row (verified by Backend 2026-09-26: history ends at 20260923132228 202609230002_plaguedoctor_encounter).
-- version = apply time in UTC, as hosted's other rows use; the exact minute was not captured, so 18:10:00 stands for "18:1x".
-- statements = the migration file as one element, as the other rows store it. created_by left null (not recorded at apply).
-- Safe to re-run: records nothing unless the 64 KB constraint is really live, and nothing if a row for this name already exists.
begin;
do $$begin
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.fighter_profiles'::regclass and conname = 'fighter_profiles_loot_check')
     not like '%pg_column_size(loot) <= 65536%' then raise exception 'fighter_profiles_loot_check is not the 64 KB cap: apply 202609260001 first'; end if;
end$$;
insert into supabase_migrations.schema_migrations (version, name, statements)
select '20260926181000', '202609260001_loot_size', array[$m$alter table public.fighter_profiles drop constraint fighter_profiles_loot_check;
alter table public.fighter_profiles add constraint fighter_profiles_loot_check
  check (jsonb_typeof(loot) = 'object' and jsonb_typeof(loot->'owned') = 'array' and jsonb_typeof(loot->'equipped') = 'object' and pg_column_size(loot) <= 65536);$m$]
where not exists (select 1 from supabase_migrations.schema_migrations where name = '202609260001_loot_size');
commit;
-- Receipt (read-only): select version, name from supabase_migrations.schema_migrations order by version desc limit 1;
--   expect 20260926181000 | 202609260001_loot_size, and 18 rows in total.
