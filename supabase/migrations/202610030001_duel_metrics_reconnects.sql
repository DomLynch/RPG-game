begin;
-- How often this page's link to its opponent was lost and re-opened during a live duel (Backend for gate 4, Strategy 2026-10-02;
-- column agreed with Duel): the relay socket re-joins that reached onopen after a loss (src/net/transport.ts join()). A page that never
-- dropped sends 0; the peer's drops are on the peer's own row. Null for rows from builds before the client sends it. A small count,
-- nothing free-form; it rides the same insert grant and caps as the rest of duel_metrics (202609300001).
alter table public.duel_metrics add column reconnects smallint check (reconnects between 0 and 1000);
grant insert (reconnects) on public.duel_metrics to anon, authenticated;
commit;
-- Rollback (as owner): begin; alter table public.duel_metrics drop column reconnects;
--   delete from supabase_migrations.schema_migrations where name = '202610030001_duel_metrics_reconnects'; commit;
