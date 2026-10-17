#!/usr/bin/env bash
# R1 backup (docs/specs/origins/launch-gates.md): a logical, data-only copy of EXACTLY the tables ops/prelaunch-reset.sql resets (one CSV per table, \copy, header row), plus a manifest
# of each table's row count and content hash (md5 over the rows' text, ordered), so a restore can be proven row for row. Read-only against the database. Nothing is deleted.
# Why \copy and not pg_dump: production is PostgreSQL 17 and this box's pg_dump/pg_restore are 16, which refuses a 17 server and cannot read a 17 archive; a CSV copy has no version
# coupling, so the restore test runs here. The WHOLE-database pg_dump (public + auth, the pinned 17.6 image) already runs daily from /etc/cron.d/frankendom-db-backup and is the second layer.
#   bash ops/prelaunch-backup.sh            env: BACKUP_ENV (/etc/frankendom/backup.env, DATABASE_URL), OUT_DIR (/root/r1-backup), PSQL, RESET_SQL (ops/prelaunch-reset.sql)
# Writes OUT_DIR/r1-<UTC stamp>/<table>.csv and manifest.tsv (files 600, directories 700) and prints the paths and the manifest. The URL (it holds the password) is turned into a mode-600
# libpq service file, never echoed, never on a command line. Run it with the writer and presence STOPPED (the runbook does) so every read sees the same rows; prove the copy with
# scripts/prelaunch-restore-test.mjs before trusting it; the real run repeats both immediately before the reset.
set -euo pipefail
umask 077
env_file=${BACKUP_ENV:-/etc/frankendom/backup.env}
out_dir=${OUT_DIR:-/root/r1-backup}
psql_bin=${PSQL:-psql}
reset_sql=${RESET_SQL:-$(dirname "$0")/prelaunch-reset.sql}
fail() { echo "prelaunch-backup FAIL: $1" >&2; exit 1; }
[[ -r $env_file ]] || fail "cannot read $env_file"
[[ -r $reset_sql ]] || fail "cannot read $reset_sql"
url=$(sed -n 's/^DATABASE_URL=//p' "$env_file" | head -n 1); url=${url#[\"\']}; url=${url%[\"\']}
[[ -n $url ]] || fail "no DATABASE_URL in $env_file"
mapfile -t tables < <(grep -oE "'origins_[a-z_]+', 'reset'" "$reset_sql" | sed -E "s/^'(origins_[a-z_]+)'.*/\1/" | sort -u)   # the RESET rows of the plan, several per line
[[ ${#tables[@]} -ge 20 ]] || fail "read only ${#tables[@]} RESET tables from $reset_sql"
mkdir -p "$out_dir"; chmod 700 "$out_dir"
svc=$(mktemp); trap 'rm -f "$svc"' EXIT
python3 -c 'import sys, urllib.parse as u
r = u.urlparse(sys.stdin.read().strip()); q = dict(u.parse_qsl(r.query))
v = {"host": r.hostname, "port": r.port, "dbname": (r.path or "/")[1:] or None, "user": u.unquote(r.username) if r.username else None, "password": u.unquote(r.password) if r.password else None, **q}
print("[fk]"); [print(f"{k}={x}") for k, x in v.items() if x is not None]' <<<"$url" >"$svc" || fail "DATABASE_URL is not a postgres URL"
export PGSERVICEFILE=$svc PGSERVICE=fk
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dest=$out_dir/r1-$stamp; part=$dest.partial
rm -rf "$part"; mkdir "$part"; chmod 700 "$part"
cleanup_fail() { rm -rf "$part"; fail "$1"; }
for t in "${tables[@]}"; do
  "$psql_bin" -X -q -v ON_ERROR_STOP=1 -c "\\copy (select * from public.$t) to '$part/$t.csv' with (format csv, header true)" >/dev/null 2>"$part/err" || { sed -E 's#postgres(ql)?://[^ ]*#<url>#g' "$part/err" >&2; cleanup_fail "copying $t failed"; }
  rm -f "$part/err"
done
sql="begin isolation level repeatable read read only; set local time zone 'UTC'; set local datestyle = 'ISO, MDY';"   # timestamptz text depends on the session zone: pin it, the restore test pins the same
for t in "${tables[@]}"; do sql+=" select '$t', count(*), coalesce(md5(string_agg(x::text, E'\n' order by x::text)), 'empty') from public.$t x;"; done
sql+=" commit;"
"$psql_bin" -X -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -c "$sql" >"$part/manifest.tsv" || cleanup_fail "the manifest query failed"
[[ $(wc -l <"$part/manifest.tsv") -eq ${#tables[@]} ]] || cleanup_fail "manifest has $(wc -l <"$part/manifest.tsv") rows, wanted ${#tables[@]}"
chmod 600 "$part"/*; mv "$part" "$dest"
echo "backup:   $dest ($(du -sk "$dest" | cut -f1) KB, ${#tables[@]} tables)"
echo "manifest: $dest/manifest.tsv"
awk -F'\t' '{ printf "  %-28s %8d rows  %s\n", $1, $2, substr($3, 1, 12) }' "$dest/manifest.tsv"
