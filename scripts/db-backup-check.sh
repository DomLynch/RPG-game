#!/usr/bin/env bash
# Real-PostgreSQL check of ops/db-backup.sh in a disposable socket-only cluster: OK path (dump, table count, log line, mode), 14-day prune, bad URL -> FAIL with no partial file and no URL in the log, and no URL in any output. Needs PG_BIN (dir with initdb/pg_ctl/psql/pg_dump/pg_restore).
set -euo pipefail
bin=${PG_BIN:-/usr/lib/postgresql/16/bin}
root=$(mktemp -d /tmp/ci-trust-db-backup-XXXXXX); port=54329
cleanup() { "$bin/pg_ctl" -D "$root/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$root"; }; trap cleanup EXIT
"$bin/initdb" -D "$root/data" -A trust --no-locale >/dev/null
"$bin/pg_ctl" -D "$root/data" -l "$root/server.log" -o "-k $root -p $port -c listen_addresses=''" -w start >/dev/null
"$bin/psql" -h "$root" -p $port -d postgres -qX -c "create table public.a(id int); create table public.b(id int); insert into public.a values (1);"
url="postgresql:///postgres?host=$root&port=$port&user=$(id -un)"
printf 'DATABASE_URL=%s\n' "$url" >"$root/backup.env"
export BACKUP_ENV=$root/backup.env BACKUP_DIR=$root/out BACKUP_LOG=$root/log PG_DUMP=$bin/pg_dump PG_RESTORE=$bin/pg_restore
fail() { echo "db-backup-check FAIL: $1" >&2; exit 1; }
out=$(bash ops/db-backup.sh) || fail "run failed: $out"
f=$root/out/frankendom-$(date +%Y%m%d).dump
[[ -s $f ]] || fail "no dump"
[[ $(stat -c %a "$f") == 600 ]] || fail "dump mode is not 600"
grep -q " OK $(date +%Y%m%d) size=[0-9]*B tables=2 " "$root/log" || fail "log line wrong: $(cat "$root/log")"
touch -d '20 days ago' "$root/out/frankendom-20200101.dump"; touch -d '13 days ago' "$root/out/frankendom-20200102.dump"
bash ops/db-backup.sh >/dev/null || fail "second run failed"
[[ ! -e $root/out/frankendom-20200101.dump && -e $root/out/frankendom-20200102.dump ]] || fail "prune kept/removed the wrong files"
printf 'DATABASE_URL=postgresql:///nope?host=%s&port=%s&user=%s\n' "$root" "$port" "$(id -un)" >"$root/backup.env"
rm -f "$f"; if bash ops/db-backup.sh >/dev/null 2>&1; then fail "bad database did not fail"; fi
[[ ! -e $f && ! -e $f.partial && ! -e $f.partial.err ]] || fail "failed run left files"
tail -n 1 "$root/log" | grep -q " FAIL $(date +%Y%m%d) pg_dump:" || fail "no FAIL line"
# The backup role (migration 0022): read-only, no login, down drops it. A stand-in auth schema proves "auth" is readable.
psql() { "$bin/psql" -h "$root" -p $port -d postgres -qXAt -v ON_ERROR_STOP=1 "$@"; }
psql -c "create schema auth; create table auth.users(id uuid); insert into auth.users values (gen_random_uuid())"
psql -f supabase/migrations/202610110022_backup_role.sql
[[ $(psql -c "select rolcanlogin from pg_roles where rolname = 'frankendom_backup'") == f ]] || fail "backup role can log in"
[[ $(psql -c "set role frankendom_backup; select count(*) from auth.users") == 1 ]] || fail "backup role cannot read auth.users"
[[ $(psql -c "set role frankendom_backup; select count(*) from public.a") == 1 ]] || fail "backup role cannot read public"
if psql -c "set role frankendom_backup; insert into public.a values (2)" 2>/dev/null; then fail "backup role can write"; fi
if psql -c "set role frankendom_backup; create table public.z(id int)" 2>/dev/null; then fail "backup role can create"; fi
psql -f supabase/down/202610110022_backup_role_down.sql
[[ $(psql -c "select count(*) from pg_roles where rolname = 'frankendom_backup'") == 0 ]] || fail "down file left the role"
echo "db-backup check: all checks passed"
