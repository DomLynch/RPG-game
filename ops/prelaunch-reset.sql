-- R1: the pre-launch reset of Origins progress (docs/specs/origins/launch-gates.md, Dom 2026-10-08: "before beta or launch we WIPE test progress and start from scratch").
-- CLASS 2, DESTRUCTIVE. It does nothing destructive unless ALL of: `-v commit=1` is passed (exactly 1), `-v confirm=...` carries the exact phrase below, `-v expect=...` carries the
-- backup manifest's counts and every RESET table holds exactly those rows, and it is run as the owner of the RESET tables (each is checked in the script, not left to TRUNCATE's privilege).
-- Lead 2026-10-17: prepared and rehearsed only; it is NEVER run on production without the Auditor's PRE and POST, the joint Lead + Strategy GO, and Dom's own word for the date.
--
--   DRY RUN (reads only: row counts per table, no lock, no DDL; safe on production at any time):
--     psql "service=..." -X -v ON_ERROR_STOP=1 -f ops/prelaunch-reset.sql
--   RESET (one transaction; stop the writer and presence first, see the runbook in docs/state/r1-prelaunch-reset.md):
--     psql "service=..." -X -v ON_ERROR_STOP=1 -v commit=1 -v confirm=R1-WIPE-ORIGINS-TEST-PROGRESS -v expect="$(awk -F'\t' '{printf "%s%s=%s", s, $1, $2; s=","}' <backup>/manifest.tsv)" -f ops/prelaunch-reset.sql
--
-- Mechanism: ONE `truncate` of exactly the RESET tables, with no CASCADE and `restart identity`. TRUNCATE fires no row triggers, so the append-only triggers on
-- origins_events, origins_item_ledger, origins_metal_ledger and origins_quest_journal (and origins_item_no_delete) neither block it nor are weakened: no trigger is disabled and
-- no function is created, so the database is left exactly as it was apart from the rows. Because there is no CASCADE, a table that references a RESET table but is not itself on the list
-- makes the statement fail and the transaction roll back, so a table this list forgot cannot be silently emptied or silently left stale. The script then verifies, inside the same
-- transaction and before COMMIT: every RESET table is at 0; every KEEP table has exactly the row count it had; and no origins_ table exists that is on neither list (a new table
-- must be classified here first; scripts/prelaunch-reset-check.mjs rehearses the same drift guard, by hand: it is not a CI job). Any failure raises and rolls everything back.
--
-- RESET: player progress and state. KEEP: the switches (origins_access, origins_config, origins_world_config, origins_switches, origins_live_events), the world's spawn state
-- (origins_spawns), and everything that is not an origins_ table (the Pit's fighter_profiles, loot_claims, awards, the duel tables, auth.users): the Pit is the base game and is untouched.
-- After a reset each account's first Origins open re-snapshots its Pit credit from fighter_profiles.victory_marks (origins_snapshot, by design: the Pit's wins seed Origins).
\set ON_ERROR_STOP on
\set phrase R1-WIPE-ORIGINS-TEST-PROGRESS

select false as do_reset \gset
\if :{?commit}
  \if :{?confirm}
    -- commit=0 (or anything but 1) is a dry run
    select (:'confirm' = :'phrase' and :'commit' = '1') as do_reset \gset
  \endif
\endif
-- :expect is the backup manifest's counts as table=n,table=n (ops/prelaunch-backup.sh writes manifest.tsv):
--   -v expect="$(awk -F'\t' '{printf "%s%s=%s", s, $1, $2; s=","}' /root/r1-backup/r1-<stamp>/manifest.tsv)"
-- A RESET refuses unless it is given, and unless every RESET table holds exactly the rows the backup holds, so the backup is the backup of THESE rows.
select (:'do_reset' and not :{?expect}) as missing_expect \gset
\if :missing_expect
  do $$ begin raise exception 'R1: refused: a reset needs -v expect=<the backup manifest counts> (see the header of ops/prelaunch-reset.sql)'; end $$;
\endif
\if :do_reset
  \echo R1: RESET MODE (the confirmation phrase matched): the transaction below truncates the RESET tables
\else
  \echo R1: DRY RUN (counts only; nothing is changed). To reset: -v commit=1 -v confirm=<the phrase in this file's header>
\endif

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create temp table r1_plan (tbl text primary key, kind text not null check (kind in ('reset', 'keep')), n_before bigint, n_after bigint) on commit drop;
insert into r1_plan (tbl, kind) values
  ('origins_characters', 'reset'), ('origins_active_character', 'reset'), ('origins_career', 'reset'), ('origins_character_build', 'reset'), ('origins_character_location', 'reset'),
  ('origins_character_renown', 'reset'), ('origins_items', 'reset'), ('origins_item_ledger', 'reset'), ('origins_metal', 'reset'), ('origins_metal_ledger', 'reset'),
  ('origins_events', 'reset'), ('origins_encounters', 'reset'), ('origins_encounter_runs', 'reset'), ('origins_creature_claims', 'reset'), ('origins_quest_state', 'reset'),
  ('origins_quest_journal', 'reset'), ('origins_talk', 'reset'), ('origins_trades', 'reset'), ('origins_trade_audit', 'reset'), ('origins_grimoire', 'reset'),
  ('origins_skill_practice', 'reset'), ('origins_skill_xp', 'reset'), ('origins_beta_ledger', 'reset'), ('origins_ground_takes', 'reset'), ('origins_spawn_engages', 'reset'),
  ('origins_access', 'keep'), ('origins_config', 'keep'), ('origins_world_config', 'keep'), ('origins_switches', 'keep'), ('origins_live_events', 'keep'), ('origins_spawns', 'keep');

-- Drift guard: every origins_ table in the database is on exactly one list, and every listed table exists.
do $$
declare unlisted text; missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into unlisted from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'origins\_%' and c.relname not in (select tbl from r1_plan);
  select string_agg(p.tbl, ', ' order by p.tbl) into missing from r1_plan p where to_regclass('public.' || p.tbl) is null;
  if unlisted is not null then raise exception 'R1: origins_ tables on neither list (classify them in ops/prelaunch-reset.sql first): %', unlisted; end if;
  if missing is not null then raise exception 'R1: listed tables that do not exist: %', missing; end if;
end $$;

-- Counts before (reads only).
do $$ declare t text; begin
  for t in select tbl from r1_plan loop execute format('update r1_plan set n_before = (select count(*) from public.%I) where tbl = %L', t, t); end loop;
end $$;
\echo -- before: rows per table (reset first, then keep)
select kind, tbl, n_before from r1_plan order by kind desc, tbl;

\if :do_reset
  -- Refuse unless run as the owner of the RESET tables, and unless they hold exactly the rows the backup holds (-v expect).
  select set_config('r1.expect', :'expect', true) as expect_set \gset
  do $$ declare bad text; begin
    if exists (select 1 from r1_plan p join pg_class c on c.oid = ('public.' || p.tbl)::regclass where p.kind = 'reset' and not pg_has_role(current_user, c.relowner, 'MEMBER')) then
      raise exception 'R1: refused: run it as the owner of the RESET tables (the database owner), not as %', current_user; end if;
    select string_agg(coalesce(p.tbl, e.tbl) || ' now ' || coalesce(p.n_before::text, '-') || ' backup ' || coalesce(e.n::text, '-'), ', ') into bad
      from (select tbl, n_before from r1_plan where kind = 'reset') p
      full join (select split_part(x, '=', 1) as tbl, split_part(x, '=', 2)::bigint as n from string_to_table(current_setting('r1.expect'), ',') as x) e on e.tbl = p.tbl
      where p.n_before is distinct from e.n;
    if bad is not null then raise exception 'R1: refused: the RESET tables do not hold the rows the backup holds: %', bad; end if;
  end $$;
  -- The destructive step: exactly the RESET tables, no CASCADE (a referencing table that is not on the list aborts the statement), identities restarted.
  select 'truncate table ' || string_agg('public.' || quote_ident(tbl), ', ' order by tbl) || ' restart identity' as stmt from r1_plan where kind = 'reset' \gset
  :stmt;
  do $$ declare t text; begin
    for t in select tbl from r1_plan loop execute format('update r1_plan set n_after = (select count(*) from public.%I) where tbl = %L', t, t); end loop;
    if exists (select 1 from r1_plan where kind = 'reset' and n_after <> 0) then raise exception 'R1: a RESET table is not at zero: %', (select string_agg(tbl || '=' || n_after, ', ') from r1_plan where kind = 'reset' and n_after <> 0); end if;
    if exists (select 1 from r1_plan where kind = 'keep' and n_after is distinct from n_before) then raise exception 'R1: a KEEP table changed: %', (select string_agg(tbl || ' ' || n_before || '->' || n_after, ', ') from r1_plan where kind = 'keep' and n_after is distinct from n_before); end if;
  end $$;
  \echo -- after: rows per table (the transaction commits next)
  select kind, tbl, n_before, n_after from r1_plan order by kind desc, tbl;
  commit;
  \echo R1: COMMITTED. Every RESET table is at 0 and every KEEP table has its row count.
\else
  rollback;
  \echo R1: dry run finished, nothing changed.
\endif
