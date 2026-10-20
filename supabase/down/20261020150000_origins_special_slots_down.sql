begin;
drop function if exists public.origins_special_slots_set(uuid, text, text, text);
drop function if exists public.origins_special_slots_get(uuid, text);
drop table if exists public.origins_special_slots;
commit;
