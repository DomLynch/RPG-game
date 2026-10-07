-- Undo 202610080002: drops the encounter run/claim tables and their functions. Settled `enc:<token>` events (kind 'mob') are append-only and stay; the tables hold only the server's
-- fight parameters and lifecycle, so dropping them forgets open fights (they would have expired as abandonments anyway). origins_encounters and its issue/consume functions are untouched.
begin;
drop function if exists public.origins_encounter_expire(int);
drop function if exists public.origins_encounter_settle(uuid, text, text, int, jsonb);
drop function if exists public.origins_encounter_touch(uuid, text, int);
drop function if exists public.origins_encounter_get(uuid, text);
drop function if exists public.origins_encounter_start(uuid, text, text, bigint, text, int, int, int, jsonb, text, text);
drop table if exists public.origins_creature_claims;
drop table if exists public.origins_encounter_runs;
commit;
