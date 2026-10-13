begin;
drop function if exists public.origins_grimoire_get(uuid);
drop function if exists public.origins_encounter_settle(uuid, text, text, int, jsonb, jsonb, jsonb);
drop table if exists public.origins_grimoire;
commit;
