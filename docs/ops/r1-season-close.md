# R1 season close: run sheet (duel ladder archive, then reset)

Owner: Backend. Migration: `202610080011_duel_season_archive` (#1818, Auditor PRE PASS @18cebc86). Ruling (Strategy + COO + Lead, 2026-10-08):
the duel ladder is ARCHIVED, then reset, never hard-deleted. **BINDING (COO):** verify the archive before the reset. Dropping `duel_ratings`
needs Dom's own words and is not in this sheet.

Two separate steps, each with its own gate:

| Step | What | Gate |
|---|---|---|
| A | apply 0011 (one table + one function, class 1) | normal path: #1818 merged by Deploy, then apply + read-back + Auditor POST |
| B | `duel_season_close('beta')` | its OWN GO: Lead + Strategy (Lead's waits on the R1 timing), Auditor before/after read-back. Not before both GOs. |

## Step A: apply 0011

1. Before (save the output):
   ```sql
   select (select max(version) from supabase_migrations.schema_migrations) last_migration,
          to_regclass('public.duel_season_ratings') is null table_absent,
          to_regprocedure('public.duel_season_close(text)') is null fn_absent;
   ```
2. Apply `supabase/migrations/202610080011_duel_season_archive.sql` at the merge sha (strip the file's own `begin;`/`commit;`; post the statements' sha256).
3. Read-back (expected: table present, RLS on, one policy, EXECUTE false for every role listed):
   ```sql
   select to_regclass('public.duel_season_ratings') is not null table_present,
          (select relrowsecurity from pg_class where oid = 'public.duel_season_ratings'::regclass) rls,
          (select count(*) from pg_policies where tablename = 'duel_season_ratings') policies,
          (select string_agg(r || ':' || has_function_privilege(r, 'public.duel_season_close(text)', 'execute')::text, ' ' order by r)
             from unnest(array['anon', 'authenticated', 'service_role', 'frankendom_origins', 'frankendom_verifier']) r) execute_by_role;
   ```
4. Auditor POST. Rollback: `supabase/down/202610080011_duel_season_archive_down.sql` (refuses once any season is archived).

## Step B: close the season (only with both GOs)

1. Before (save the output; this is what the archive must equal):
   ```sql
   select count(*) live_rows, coalesce(sum(rating), 0) rating_sum, md5(coalesce(string_agg(user_id::text || ':' || rating, ',' order by user_id), '')) live_digest,
          (select count(*) from public.duel_counted_wins) counted_wins,
          (select count(*) from public.duel_season_ratings where season = 'beta') archived_beta
   from public.duel_ratings;
   ```
   Expected: `archived_beta = 0`. (Prod 2026-10-08 13:2x: `duel_ratings` 0 rows.)
2. Run, as the owner (dashboard SQL / MCP `execute_sql`; no other role can):
   ```sql
   select public.duel_season_close('beta');
   ```
   It locks the ladder, copies it, checks count + sum + every row, and only then empties `duel_ratings`. Any mismatch raises and NOTHING changes.
   The returned `{archived, rating_sum, live_after}` must show `archived = live_rows`, `rating_sum` equal, `live_after = 0`.
3. Read-back (the COO's binding check):
   ```sql
   select count(*) archived_rows, coalesce(sum(rating), 0) rating_sum,
          md5(coalesce(string_agg(user_id::text || ':' || rating, ',' order by user_id), '')) archived_digest,
          (select count(*) from public.duel_ratings) live_after,
          (select count(*) from public.duel_counted_wins) counted_wins
   from public.duel_season_ratings where season = 'beta';
   ```
   Pass: `archived_rows = live_rows`, `rating_sum` and digest equal to step 1, `live_after = 0`, `counted_wins` unchanged.
4. Readable: as a player who had a rating, `select rating from public.duel_season_ratings` returns their own row only.
5. Auditor POST. No rollback deletes the archive: a wrong close is fixed forward (re-insert from the archive into `duel_ratings` under a GO).
