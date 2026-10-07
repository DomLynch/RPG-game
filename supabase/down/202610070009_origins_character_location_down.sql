begin;
-- Drops exactly what 202610070009_origins_character_location.sql creates, in reverse dependency order. Nothing else depends on these objects; no existing
-- table, function or grant is touched (the two foreign keys to auth.users and origins_characters go with their tables).
drop function public.origins_active(uuid), public.origins_saved_location(uuid), public.origins_save_location(uuid, int, int, text, bigint), public.origins_set_active(uuid, text);
drop table public.origins_character_location, public.origins_active_character;
commit;
