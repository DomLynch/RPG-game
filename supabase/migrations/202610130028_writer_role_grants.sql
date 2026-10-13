-- CLASS 1: GRANT only. No table, column, function body or data changes; idempotent.
-- The Origins writer connects as frankendom_verifier (202610080001, #1639), not frankendom_origins. Four functions it calls were granted to frankendom_origins only,
-- so every call from the writer failed with "permission denied for function" (live ops: the kill switches never reached the writer).
-- Down: revoke execute on function public.origins_live_ops(), public.origins_mint_keys_held(uuid, text[]), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) from frankendom_verifier;
revoke all on function public.origins_live_ops(), public.origins_mint_keys_held(uuid, text[]), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) from public, anon, authenticated;
grant execute on function public.origins_live_ops(), public.origins_mint_keys_held(uuid, text[]), public.origins_set_build(uuid, text, jsonb, int, int), public.origins_set_level(uuid, text, int) to frankendom_origins, frankendom_verifier;
