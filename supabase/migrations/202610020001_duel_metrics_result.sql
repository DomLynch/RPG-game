begin;
-- How a live duel ended (Duel lane; Strategy 2026-10-01: a dropped peer gets ~10 s to rejoin, then the page that stayed wins by forfeit,
-- recorded here; src/net/pvp.ts SILENCE). One closed set, nothing free-form: finished (played to a settled finish), forfeit-win (the peer
-- left), forfeit-loss (this page left), no-contest (neither page could say who left). Null for a row sent before the duel ended (the page
-- hid). The column rides the same insert grant and caps as the rest of duel_metrics (202609300001); PVP_REWARDS stays false, so none of
-- these results touches marks, rank or loot.
alter table public.duel_metrics add column result text check (result in ('finished', 'forfeit-win', 'forfeit-loss', 'no-contest'));
grant insert (result) on public.duel_metrics to anon, authenticated;
commit;
-- Rollback (as owner): begin; alter table public.duel_metrics drop column result;
--   delete from supabase_migrations.schema_migrations where name = '202610020001_duel_metrics_result'; commit;
