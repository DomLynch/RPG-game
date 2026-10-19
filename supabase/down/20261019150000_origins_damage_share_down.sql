-- ROLLBACK of 20261019150000_origins_damage_share.sql: drops exactly what it created. The damage ledger rows go with the table; no kill, ledger or career row is touched.
begin;
drop function public.origins_spawn_kill_v2(uuid, text, int, int, jsonb, jsonb, numeric, int);
drop function public.origins_spawn_damage_read(text, int);
drop function public.origins_spawn_check(uuid, text, int, int);
drop table public.origins_spawn_damage;
commit;
