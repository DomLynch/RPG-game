#!/usr/bin/env bash
# R1 backup (docs/specs/origins/launch-gates.md): a data-only pg_dump of EXACTLY the tables ops/prelaunch-reset.sql resets, plus a manifest of each table's row count and content hash
# (md5 over the rows' text, ordered), so a restore can be proven row for row. Read-only against the database. Nothing is deleted.
#   bash ops/prelaunch-backup.sh            env: BACKUP_ENV (/etc/frankendom/backup.env, DATABASE_URL), OUT_DIR (/root/r1-backup), PG_DUMP, PSQL, RESET_SQL (ops/prelaunch-reset.sql)
# Writes OUT_DIR/r1-<UTC stamp>.dump and .manifest.tsv (mode 600, dir 700) and prints their paths and the manifest. The URL (it holds the password) is turned into a mode-600 libpq
# service file, never echoed, never on a command line. Prove the dump with scripts/prelaunch-restore-test.mjs before trusting it; the real run repeats both immediately before the reset.
set -euo pipefail
umask 077
env_file=${BACKUP_ENV:-/etc/frankendom/backup.env}
out_dir=${OUT_DIR:-/root/r1-backup}
pg_dump_bin=${PG_DUMP:-pg_dump}
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
dump=$out_dir/r1-$stamp.dump; manifest=$out_dir/r1-$stamp.manifest.tsv
args=(); for t in "${tables[@]}"; do args+=(-t "public.$t"); done
# The dump and the manifest are two reads: run this with the writer and presence STOPPED (the runbook does), so they describe the same rows; if a row moved between them the restore test
# below reports a hash mismatch rather than passing.
"$pg_dump_bin" -Fc -a --no-owner "${args[@]}" -f "$dump.partial" 2>"$dump.err" || { sed -E 's#postgres(ql)?://[^ ]*#<url>#g' "$dump.err" >&2; rm -f "$dump.partial" "$dump.err"; fail "pg_dump failed"; }
rm -f "$dump.err"
sql="begin isolation level repeatable read read only; set local time zone 'UTC'; set local datestyle = 'ISO, MDY';"   # timestamptz text depends on the session zone: pin it, the restore test pins the same
for t in "${tables[@]}"; do sql+=" select '$t', count(*), coalesce(md5(string_agg(x::text, E'\n' order by x::text)), 'empty') from public.$t x;"; done
sql+=" commit;"
"$psql_bin" -X -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -c "$sql" >"$manifest.partial" || { rm -f "$dump.partial" "$manifest.partial"; fail "the manifest query failed"; }
[[ $(wc -l <"$manifest.partial") -eq ${#tables[@]} ]] || { rm -f "$dump.partial" "$manifest.partial"; fail "manifest has $(wc -l <"$manifest.partial") rows, wanted ${#tables[@]}"; }
listed=$("${PG_RESTORE:-pg_restore}" --list "$dump.partial" 2>/dev/null | grep -c ' TABLE DATA ' || true)
[[ $listed -eq ${#tables[@]} ]] || { rm -f "$dump.partial" "$manifest.partial"; fail "the dump lists $listed TABLE DATA entries, wanted ${#tables[@]}"; }
mv "$dump.partial" "$dump"; mv "$manifest.partial" "$manifest"; chmod 600 "$dump" "$manifest"
echo "dump:     $dump ($(stat -c %s "$dump" 2>/dev/null || stat -f %z "$dump") bytes, ${#tables[@]} tables)"
echo "manifest: $manifest"
awk -F'\t' '{ printf "  %-28s %8d rows  %s\n", $1, $2, substr($3, 1, 12) }' "$manifest"
