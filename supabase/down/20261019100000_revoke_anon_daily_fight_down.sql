-- Undoes supabase/migrations/20261019100000_revoke_anon_daily_fight.sql: EXECUTE on public.daily_fight(date) back to anon (the grant 202609210003 made).
begin;
grant execute on function public.daily_fight(date) to anon;
commit;
