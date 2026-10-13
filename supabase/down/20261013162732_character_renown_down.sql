begin;
-- Undoes 202610130030_character_renown.sql. Fame and karma then read as absent (renown_get answers 503); the stored values are lost with the table.
drop function if exists public.origins_add_renown(uuid, text, int, int);
drop function if exists public.origins_get_renown(uuid, text);
drop table if exists public.origins_character_renown;
commit;
