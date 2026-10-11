begin;
-- Undoes 202610100018_origins_mint_keys_held.sql. The writer falls back to the live view (store.mintKeysHeld asks to_regprocedure first), so nothing else needs to change.
drop function if exists public.origins_mint_keys_held(uuid, text[]);
commit;
