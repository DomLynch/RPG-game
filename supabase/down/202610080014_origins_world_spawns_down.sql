-- Rollback of 202610080014_origins_world_spawns.sql: drops exactly what it created (rewards already applied by kill reports stay; the beta ledger, 0015, wipes those).
begin;
drop function public.origins_spawn_kill(uuid, text, int, int, jsonb, jsonb);
drop function public.origins_spawn_touch(uuid, text);
drop function public.origins_spawn_engage_get(uuid, text);
drop function public.origins_spawn_engage(uuid, text, text, text, text);
drop function public.origins_spawn_state(text[]);
drop function public.origins_spawn_view(public.origins_spawns);
drop table public.origins_beta_ledger;
drop table public.origins_spawn_engages;
drop table public.origins_spawns;
drop table public.origins_world_config;
commit;
