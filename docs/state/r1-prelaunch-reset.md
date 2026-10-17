# R1 pre-launch reset: runbook

Launch gate R1 (`docs/specs/origins/launch-gates.md`). Class 2, destructive. **Prepared and rehearsed only. Never run on production** without the Auditor's PRE (on the script) and POST (on the run), the joint Lead + Strategy GO, and Dom's own word for the date.

## Open decisions (Dom decides; the script is ready either way)

1. **Run date.** Dom decides. Nothing in this PR schedules it.
2. **Duel ladder.** Dom decides whether R1 also wipes the duel ladder. As built, the Pit is KEEP: `fighter_profiles`, `loot_claims`, `awards` and the duel tables are untouched, and the Pit's verified claims are marked consumed rather than deleted so an old claim cannot re-pay into a new career. Wiping the ladder too is a separate, additional step and would need its own PRE.

## What it does

`ops/prelaunch-reset.sql`: one `truncate` of exactly the RESET tables (no CASCADE, `restart identity`), inside one transaction. No trigger is disabled and no function is created. It verifies before COMMIT that every RESET table is at 0, every KEEP table kept its row count, and no `origins_` table is on neither list; any failure rolls everything back. It does nothing destructive unless run as the database owner with `-v commit=1` and `-v confirm=R1-WIPE-ORIGINS-TEST-PROGRESS`. Without those it is a read-only dry run.

KEEP: `origins_access`, `origins_config`, `origins_world_config`, `origins_switches`, `origins_live_events`, `origins_spawns`, and everything that is not an `origins_` table.

## Checks already done (rehearsal, not production)

- `node scripts/prelaunch-reset-check.mjs` on a disposable Postgres with every repo migration applied: dry run changes nothing, a wrong or missing phrase changes nothing, the real reset leaves RESET at 0 and KEEP unchanged, a second reset is a no-op, the append-only triggers are still installed, an unclassified new table makes the script refuse, and the recovery drill restores into the emptied database (32 checks passing).
- Production receipts taken read-only on 2026-10-17: dry-run counts, and a backup of 25 tables (114 rows) on the VPS with the restore proven. The backup is root-only and holds player data.

## Run order (when Dom names the date)

Needs, in writing in the PR thread before step 1: Auditor PRE, Lead + Strategy GO, Dom's date and his answer on the ladder.

1. Announce the window. Stop the writer and presence so every read sees the same rows:
   `systemctl stop frankendom-origins-writer frankendom-presence`
2. Backup, immediately before the reset (repeats the earlier one on the then-current rows):
   `bash ops/prelaunch-backup.sh` (writes `/root/r1-backup/r1-<UTC stamp>/`, files 600, directories 700).
3. Prove the backup restores, as a non-root user (as `postgres` on the VPS):
   `node scripts/prelaunch-restore-test.mjs /root/r1-backup/r1-<stamp>` must print "restore proven".
4. Dry run against production, read-only, and save the counts to the PR:
   `psql "service=..." -X -v ON_ERROR_STOP=1 -f ops/prelaunch-reset.sql`
5. Auditor reads the dry-run counts. Then the reset, as the database owner:
   `psql "service=..." -X -v ON_ERROR_STOP=1 -v commit=1 -v confirm=R1-WIPE-ORIGINS-TEST-PROGRESS -f ops/prelaunch-reset.sql`
6. Read the counts back: RESET tables at 0, KEEP tables unchanged. Post them for the Auditor's POST.
7. Start the writer and presence, then confirm a fresh account opens Origins and re-snapshots its Pit credit.
8. **Shred the backup after the wipe is accepted** (it holds player data): `shred -u` each file in the backup directory, then remove the directory. The daily whole-database dump from `/etc/cron.d/frankendom-db-backup` stays as the second layer.

## Rollback

Before COMMIT any failure rolls back on its own. After COMMIT, restore from the step 2 backup with the same loader the restore test uses (`restoreInto` in `scripts/prelaunch-restore-test.mjs`), or from the daily dump.

## Gotchas

- Production is PostgreSQL 17 and the VPS `pg_dump` is 16, which refuses a 17 server. That is why the backup is a CSV `\copy` plus a manifest hash, not `pg_dump`.
- Generated columns are left out of the copy and recomputed on restore; the manifest hash is over whole rows, so it proves them equal.
- The manifest hash uses canonical jsonb and the C collation, because production and a scratch cluster order text differently and added columns in a different sequence.
- `origins_metal_ledger` and the other ledgers are append-only by trigger. TRUNCATE fires no row triggers, which is why the reset needs no trigger changes.
