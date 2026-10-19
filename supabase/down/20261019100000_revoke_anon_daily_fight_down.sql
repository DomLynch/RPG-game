-- Undoes supabase/migrations/20261019100155_revoke_anon_daily_fight.sql (applied on prod as 20261019100155; this file keeps the stamp it was written under): EXECUTE on public.daily_fight(date) back to anon (the grant 202609210003 made).
begin;
grant execute on function public.daily_fight(date) to anon;
commit;
