-- CLASS 1: GRANT only. No table, column, function body or data changes; idempotent.
-- The Origins writer connects as frankendom_verifier (202610080001, #1639), not frankendom_origins (the same defect 202610130028 fixed for four other functions).
-- 202610130029 granted origins_skill_focus(uuid, text, text, boolean) to frankendom_origins only, so every skill_focus from the writer fails with "permission denied for function".
-- Down: revoke execute on function public.origins_skill_focus(uuid, text, text, boolean) from frankendom_verifier;
revoke all on function public.origins_skill_focus(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.origins_skill_focus(uuid, text, text, boolean) to frankendom_origins, frankendom_verifier;
