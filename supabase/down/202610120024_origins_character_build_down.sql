begin;
-- Undoes 202610120024_origins_character_build.sql. The build field then reads as absent (build_get answers the all-base default, build_set answers 503).
drop function if exists public.origins_set_level(uuid, text, int);
drop function if exists public.origins_set_build(uuid, text, jsonb, int, int);
drop function if exists public.origins_get_build(uuid, text, int);
drop table if exists public.origins_character_build;
commit;
