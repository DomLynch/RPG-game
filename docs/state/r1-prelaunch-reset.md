# R1 pre-launch reset: runbook

Launch gate R1 (`docs/specs/origins/launch-gates.md`). Class 2, destructive. **Prepared and rehearsed only. Never run on production** without the Auditor's PRE (on the script) and POST (on the run), the joint Lead + Strategy GO, and Dom's own word for the date.

## Open decisions (Dom decides; the script is ready either way)

1. **Run date.** Dom decides. Nothing in this PR schedules it.
2. **The Pit: marks, claims, duel ladder.** Dom decides whether R1 also wipes any of them. **Default: KEEP, and the script as built does not touch them.** `fighter_profiles` (including `victory_marks`), `loot_claims`, `awards` and the duel tables are untouched; the script does not mark or consume any claim. What happens afterwards is by design: each account's first Origins open runs `origins_snapshot`, which re-seeds the new career's Pit credit from `fighter_profiles.victory_marks`, so the Pit's wins seed the fresh career again (the rehearsal asserts exactly that). If Dom wants a different answer, wiping marks, claims or the ladder is an extra step with its own PRE, not a switch in this script.

## What it does

`ops/prelaunch-reset.sql`: one `truncate` of exactly the RESET tables (no CASCADE, `restart identity`), inside one transaction. No trigger is disabled and no function is created. It verifies before COMMIT that every RESET table is at 0, every KEEP table kept its row count, and no `origins_` table is on neither list; any failure rolls everything back. It does nothing destructive unless ALL of: `-v commit=1` (exactly 1), `-v confirm=R1-WIPE-ORIGINS-TEST-PROGRESS`, `-v expect=<the backup manifest's counts>` with every RESET table holding exactly those rows (so the backup is the backup of these rows), and it is run as the owner of the RESET tables (checked in the script). Without those it is a read-only dry run, or it refuses.

KEEP: `origins_access`, `origins_config`, `origins_world_config`, `origins_switches`, `origins_live_events`, `origins_spawns`, and everything that is not an `origins_` table (including `auth.users`).

The drift guard (a new `origins_` table on neither list refuses the run) is rehearsed by `scripts/prelaunch-reset-check.mjs`, which is run by hand; it is **not** a CI job.

## Which database role

On production the tables are owned by `postgres` (31 `origins_` tables, read from the catalog 2026-10-17), which is **not** a superuser, and the read-only backup role (`frankendom_backup`, in `/etc/frankendom/backup.env`) is refused `set session_replication_role` and owns nothing. So:

- the **backup** runs with `backup.env` (read-only is enough);
- the **reset and the restore** run as the owner (`postgres`). Its URL is not on the VPS today; Dom supplies it for the run in a root-only file, passed as `RESTORE_ENV=<file>` to `ops/prelaunch-restore.sh`, and as a mode-600 libpq service file to the reset. Delete the file after.
- the restore needs **no superuser right**: as owner it switches the tables' USER triggers off inside its one transaction and back on before COMMIT (`alter table ... disable trigger user`), loads parents before children (foreign keys stay on), and refuses a non-empty target.

## Checks already done (rehearsal, not production)

- `node scripts/prelaunch-reset-check.mjs` on a disposable Postgres 16 with every repo migration applied, **with the backup, reset and restore run as a non-superuser owner role** like production's: 52 checks. Dry run changes nothing; a wrong or missing phrase, `commit=0`, a missing or wrong `expect`, and a non-owner role all refuse or stay dry; the real reset leaves RESET at 0 and KEEP unchanged; a second reset is a no-op; the append-only triggers are still installed and enabled; an unclassified new table refuses the run.
- The recovery drill goes through `ops/prelaunch-restore.sh` (the real path, a service file): the backup restores into the emptied database row for row (counts and content hashes), all triggers end enabled, a second restore into the full database refuses, and **the identity sequences are advanced to max(id)**: a mint (item ledger) and a bronze award (metal ledger) right after the restore both succeed, and no identity sequence (including `origins_trade_audit`) is behind its table. Breaking the `setval` makes the drill fail (checked 2026-10-17).
- Production, read-only, 2026-10-17: dry-run counts, and a backup of 25 tables (114 rows) with the restore proven on a scratch cluster. The backup is root-only and holds player data. The `probe` mode of `ops/prelaunch-restore.sh` against production with the backup role correctly refuses ("31 of 31 are not its own"), and the catalog read shows the owner is `postgres`, non-superuser.
- **Not yet done:** a `probe` run as the owner role on production (needs the owner URL; Dom supplies it at run time, the probe is a read-only catalog query).

## Run order (when Dom names the date)

Needs, in writing in the PR thread before step 1: Auditor PRE, Lead + Strategy GO, Dom's date, Dom's answer on the Pit (default KEEP), and the owner URL file.

1. Announce the window. Stop the writer and presence so every read sees the same rows:
   `systemctl stop frankendom-origins-writer frankendom-presence`
2. Probe, as the owner (the Auditor's run-day conditions a to c):
   - `RESTORE_ENV=<owner env file> bash ops/prelaunch-restore.sh probe` must print "probe ok". It also lists, and refuses on, any user trigger on an `origins_` table that is already disabled (`tgenabled <> 'O'`), because the restore would switch it on.
   - As the owner, on production: `begin; alter table public.origins_events disable trigger user; rollback;` must succeed (proves the owner may switch user triggers off; the lock is brief and the transaction is rolled back at once, so run it with the writer stopped).
3. Backup, immediately before the reset: `bash ops/prelaunch-backup.sh` (writes `/root/r1-backup/r1-<UTC stamp>/`, files 600, directories 700).
4. Prove the backup restores into a scratch cluster, as a non-root user (as `postgres` on the VPS): `node scripts/prelaunch-restore-test.mjs /root/r1-backup/r1-<stamp>` must print "restore proven".
5. Dry run against production, read-only, with the counts from step 3 (save the output to the PR):
   `psql "service=..." -X -v ON_ERROR_STOP=1 -v expect="$(awk -F'\t' '{printf "%s%s=%s", s, $1, $2; s=","}' <backup>/manifest.tsv)" -f ops/prelaunch-reset.sql`
6. Auditor reads the dry-run counts. Then the reset, as the owner:
   `psql "service=..." -X -v ON_ERROR_STOP=1 -v commit=1 -v confirm=R1-WIPE-ORIGINS-TEST-PROGRESS -v expect="$(awk ...same as step 5...)" -f ops/prelaunch-reset.sql`
7. Read the counts back: RESET tables at 0, KEEP tables unchanged. Post them for the Auditor's POST.
8. Start the writer and presence, then confirm a fresh account opens Origins and re-snapshots its Pit credit.
9. **Shred the backup after the wipe is accepted** (it holds player data): `shred -u` each file, then remove the directory. Delete the owner env file. The daily whole-database dump from `/etc/cron.d/frankendom-db-backup` stays as the second layer.

## Rollback

Before COMMIT any failure rolls back on its own. After COMMIT: stop the writer and presence, then `RESTORE_ENV=<owner env file> bash ops/prelaunch-restore.sh restore /root/r1-backup/r1-<stamp>` (one transaction; refuses unless the tables are empty, which they are right after the reset), then compare each table's count and hash with `manifest.tsv` (`measure` in `scripts/prelaunch-restore-test.mjs`). The accounts in `auth.users` are untouched by the reset, which the restore's foreign keys need. Or restore from the daily dump.

## Gotchas

- Production is PostgreSQL 17 and the VPS `pg_dump` is 16, which refuses a 17 server. That is why the backup is a CSV `\copy` plus a manifest hash, not `pg_dump`.
- Production's role cannot `set session_replication_role` (permission denied, probe 2026-10-17). An earlier draft of the restore used it and could not have worked; do not reintroduce it.
- `COPY` does not advance identity sequences. The restore sets them to max(id); without that the next ledger write collides with a restored id.
- Generated columns are left out of the copy and recomputed on restore; the manifest hash is over whole rows, so it proves them equal.
- The manifest hash uses canonical jsonb and the C collation, because production and a scratch cluster order text differently and added columns in a different sequence.
- `origins_metal_ledger` and the other ledgers are append-only by trigger. TRUNCATE fires no row triggers, which is why the reset needs no trigger changes.
