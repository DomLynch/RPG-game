#!/usr/bin/env bash
# Daily logical backup of the Frankendom game database (Supabase) to the storage box.
# pg_dump -Fc of the schemas in DB_SCHEMAS (default: public) -> BACKUP_DIR/frankendom-YYYYMMDD.dump, verified with pg_restore --list (non-empty, TABLE entries counted), files older than KEEP_DAYS deleted, ONE log line per run.
# The connection string is read from BACKUP_ENV (DATABASE_URL) and turned into a mode-600 libpq service file for pg_dump (PGSERVICEFILE): never echoed, never logged, never on a command line (ps shows arguments to every user).
#   bash ops/db-backup.sh      env: BACKUP_ENV (/etc/frankendom/backup.env), BACKUP_DIR (/mnt/frankendom-donors/_backups/db), KEEP_DAYS (14), DB_SCHEMAS (public), PG_DUMP (pg_dump), PG_RESTORE (pg_restore), DB_WARN_MB (400; the log line says WARN above this database size, Supabase free is capped at 500 MB), PSQL (psql), DUMP_IMAGE (unset; e.g. postgres:17.6 runs pg_dump/pg_restore from that image instead, needed when the host client is older than the server), DOCKER_ARGS (extra docker run args, tests only), BACKUP_LOG (/var/log/frankendom-db-backup.log)
# Cron (root): 17 3 * * * /bin/bash /opt/frankendom/ops/db-backup.sh   (path of the installed repo copy)
set -uo pipefail
umask 077
env_file=${BACKUP_ENV:-/etc/frankendom/backup.env}
dir=${BACKUP_DIR:-/mnt/frankendom-donors/_backups/db}
keep=${KEEP_DAYS:-14}
schemas=${DB_SCHEMAS:-public}
pg_dump_bin=${PG_DUMP:-pg_dump}
pg_restore_bin=${PG_RESTORE:-pg_restore}
log=${BACKUP_LOG:-/var/log/frankendom-db-backup.log}
day=$(date +%Y%m%d)
out="$dir/frankendom-$day.dump"
part="$out.partial"
say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >>"$log" 2>/dev/null || true; printf '%s\n' "$1"; }
fail() { rm -f "$part"; say "FAIL $day $1"; exit 1; }
[[ $keep =~ ^[0-9]+$ ]] && (( keep >= 1 )) || fail "KEEP_DAYS must be an integer >= 1"
[[ -r $env_file ]] || fail "cannot read $env_file"
url=$(sed -n 's/^DATABASE_URL=//p' "$env_file" | head -n 1)
url=${url#[\"\']}; url=${url%[\"\']}
[[ -n $url ]] || fail "no DATABASE_URL in $env_file"
mkdir -p "$dir" || fail "cannot create $dir"
args=(); for s in $schemas; do args+=(-n "$s"); done
for t in auth.refresh_tokens auth.sessions auth.one_time_tokens auth.mfa_challenges auth.flow_state; do args+=(--exclude-table-data "$t"); done
svc=$(mktemp) || fail "cannot create the service file"; trap 'rm -f "$svc" "$part.err"' EXIT
python3 -c 'import sys, urllib.parse as u
r = u.urlparse(sys.stdin.read().strip()); q = dict(u.parse_qsl(r.query))
v = {"host": r.hostname, "port": r.port, "dbname": (r.path or "/")[1:] or None, "user": u.unquote(r.username) if r.username else None, "password": u.unquote(r.password) if r.password else None, **q}
print("[fk]"); [print(f"{k}={x}") for k, x in v.items() if x is not None]' <<<"$url" >"$svc" || fail "DATABASE_URL is not a postgres URL"
if [[ -n ${DUMP_IMAGE:-} ]]; then
  # --network host: the Supabase direct host (db.<ref>.supabase.co) is IPv6-only and the default docker bridge has no IPv6 ("Network is unreachable", first manual run 10-11).
  # shellcheck disable=SC2206
  dump=(docker run --rm --network host --user root -v "$svc:/svc:ro" -v "$dir:/out" -e PGSERVICEFILE=/svc -e PGSERVICE=fk ${DOCKER_ARGS:-} "$DUMP_IMAGE" pg_dump -Fc "${args[@]}" -f "/out/${part##*/}")
  restore_list() { docker run --rm -i "$DUMP_IMAGE" pg_restore --list <"$1"; }
  db_bytes() { docker run --rm --network host -e PGSERVICEFILE=/svc -e PGSERVICE=fk -v "$svc:/svc:ro" ${DOCKER_ARGS:-} "$DUMP_IMAGE" psql -AtX -c 'select pg_database_size(current_database())'; }
else
  dump=(env PGSERVICEFILE="$svc" PGSERVICE=fk "$pg_dump_bin" -Fc "${args[@]}" -f "$part")
  restore_list() { "$pg_restore_bin" --list "$1"; }
  db_bytes() { PGSERVICEFILE=$svc PGSERVICE=fk "${PSQL:-psql}" -AtX -c 'select pg_database_size(current_database())'; }
fi
if ! "${dump[@]}" 2>"$part.err"; then
  msg=$(head -n 2 "$part.err" | tr '\n' ' ' | cut -c1-200); rm -f "$part.err"
  fail "pg_dump: $msg"
fi
rm -f "$part.err"
list=$(restore_list "$part" 2>/dev/null) || fail "pg_restore --list rejected the dump"
tables=$(printf '%s\n' "$list" | grep -cP '^\d+; \d+ \d+ TABLE (?!DATA )' || true)
(( tables > 0 )) || fail "dump has no TABLE entries"
size=$(stat -c %s "$part")
(( size > 0 )) || fail "dump is empty"
mv -f "$part" "$out" || fail "cannot move dump into place"
find "$dir" -maxdepth 1 -type f -name 'frankendom-????????.dump' -mtime "+$((keep - 1))" -delete
status=OK; dbmb='?'
if bytes=$(db_bytes 2>/dev/null) && [[ $bytes =~ ^[0-9]+$ ]]; then
  dbmb=$((bytes / 1048576))
  (( dbmb > ${DB_WARN_MB:-400} )) && status=WARN
fi
say "$status $day size=${size}B tables=$tables db=${dbmb}MB schemas=$schemas file=$out"
