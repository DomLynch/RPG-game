begin;
-- ROLLBACK: supabase/down/20261019100000_revoke_anon_daily_fight_down.sql (grants EXECUTE back to anon).
-- CLASS 1, SUBTRACTIVE grant change only: ONE revoke of EXECUTE on public.daily_fight(date) from the anon role. No table, column, index, policy or function body is touched.
-- Why (Strategy ruling 2026-10-19, launch-track security review, Supabase advisor 0028 anon_security_definer_function_executable): daily_fight returns the day's seed from a hidden secret and is
-- unused surface: the client does not call it (scripts/account-browser-check.mjs: "the daily_fight / daily_board_summary endpoints stay on the server, unused by this client"). A guest has no reason
-- to hold it. Kept: authenticated (a signed-in fighter) and frankendom_verifier (the daily verifier, 202609210005). The future-day refusal and the secret are unchanged.
-- Not touched on purpose: public.daily_board (kept security-definer by ruling) and public.mint_share (guest share links, rate-limited, by design).
revoke execute on function public.daily_fight(date) from anon;
commit;
