begin;
drop function if exists public.origins_encounter_settle(uuid, text, text, int, jsonb, jsonb);
drop table if exists public.origins_skill_practice;
drop table if exists public.origins_skill_xp;
commit;
