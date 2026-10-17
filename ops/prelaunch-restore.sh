#!/usr/bin/env bash
# R1 restore (docs/state/r1-prelaunch-reset.md): puts an R1 backup (ops/prelaunch-backup.sh) back into the REAL database through a mode-600 libpq service file, the way the backup reads it.
# This is the recovery path the rehearsal (scripts/prelaunch-reset-check.mjs) exercises: the same script, pointed at a scratch cluster.
#   bash ops/prelaunch-restore.sh probe                       check, in a transaction that is rolled back, that this role may `set local session_replication_role = replica`. Changes nothing.
#   bash ops/prelaunch-restore.sh restore <r1-... backup dir> load the CSVs in ONE transaction (see restoreSql in scripts/prelaunch-restore-test.mjs): refuses a non-empty table, leaves
#                                                             the append-only triggers alone, advances the identity sequences to max(id). Run it only after a reset, with the writer stopped.
#   env: BACKUP_ENV (/etc/frankendom/backup.env, DATABASE_URL), PSQL, NODE. The URL (it holds the password) is turned into a service file, never echoed, never on a command line.
set -euo pipefail
umask 077
env_file=${BACKUP_ENV:-/etc/frankendom/backup.env}
psql_bin=${PSQL:-psql}
node_bin=${NODE:-node}
here=$(cd "$(dirname "$0")" && pwd)
fail() { echo "prelaunch-restore FAIL: $1" >&2; exit 1; }
mode=${1:-}
[[ $mode == probe || $mode == restore ]] || fail "usage: prelaunch-restore.sh probe | restore <backup directory>"
[[ -r $env_file ]] || fail "cannot read $env_file"
url=$(sed -n 's/^DATABASE_URL=//p' "$env_file" | head -n 1); url=${url#[\"\']}; url=${url%[\"\']}
[[ -n $url ]] || fail "no DATABASE_URL in $env_file"
svc=$(mktemp); trap 'rm -f "$svc"' EXIT
python3 -c 'import sys, urllib.parse as u
r = u.urlparse(sys.stdin.read().strip()); q = dict(u.parse_qsl(r.query))
v = {"host": r.hostname, "port": r.port, "dbname": (r.path or "/")[1:] or None, "user": u.unquote(r.username) if r.username else None, "password": u.unquote(r.password) if r.password else None, **q}
print("[fk]"); [print(f"{k}={x}") for k, x in v.items() if x is not None]' <<<"$url" >"$svc" || fail "DATABASE_URL is not a postgres URL"
export PGSERVICEFILE=$svc PGSERVICE=fk
scrub() { sed -E 's#postgres(ql)?://[^ ]*#<url>#g'; }
if [[ $mode == probe ]]; then
  out=$("$psql_bin" -X -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -c "begin; set local session_replication_role = replica; select current_user, current_setting('session_replication_role'), (select rolsuper from pg_roles where rolname = current_user), version(); rollback;" 2>&1 | scrub) || fail "the role may not set session_replication_role: $out"
  echo "$out"
  [[ $out == *$'\treplica\t'* ]] || fail "session_replication_role did not become replica"
  echo "probe ok: this role can set local session_replication_role = replica (transaction rolled back, nothing changed)"
  exit 0
fi
dir=${2:-}
[[ -n $dir && -r $dir/manifest.tsv ]] || fail "give the r1-... backup directory (it holds manifest.tsv)"
sql=$("$node_bin" "$here/../scripts/prelaunch-restore-test.mjs" --sql "$dir") || fail "could not build the restore script"
"$psql_bin" -X -q -v ON_ERROR_STOP=1 <<<"$sql" 2> >(scrub >&2) || fail "the restore failed; it ran in one transaction, so nothing was loaded"
echo "restored: $dir (one transaction, triggers not fired, identity sequences advanced to max(id)). Now prove it: compare each table's count and hash with $dir/manifest.tsv"
