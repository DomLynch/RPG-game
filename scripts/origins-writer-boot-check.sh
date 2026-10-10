#!/usr/bin/env bash
# Boot check for the origins writer on a CANDIDATE tree, run BEFORE a reinstall (Strategy ruling 2026-10-10 after release AA crash-looped the box on a missing `three`).
#   bash scripts/origins-writer-boot-check.sh [<git rev>]      default: HEAD of the checkout this runs in
# Exports the tree WITHOUT node_modules (as the box has none), starts the writer on a scratch port with dummy credentials, waits for "listening", sends one
# unauthenticated /origins/spawn_state (want 401), stops it, exits 0 only if all of that held. No secrets, no database, no network beyond 127.0.0.1.
set -euo pipefail
rev="${1:-HEAD}"; port="${BOOT_CHECK_PORT:-8796}"; D=$(mktemp -d /var/tmp/writer-boot-XXXXXX); pid=""
cleanup() { [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; rm -rf "$D"; }; trap cleanup EXIT
git archive "$rev" | tar -x -C "$D"
cd "$D"
env -i PATH="$PATH" PORT="$port" DATABASE_URL=postgres://u:p@127.0.0.1:1/x SUPABASE_URL=http://127.0.0.1:1 SUPABASE_ANON_KEY=dummy node scripts/origins-writer.mjs > boot.log 2>&1 & pid=$!
for _ in $(seq 1 20); do grep -q 'listening on' boot.log && break; kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
grep -q 'listening on' boot.log || { echo "BOOT FAIL: the writer did not start"; head -8 boot.log | cut -c1-200; exit 1; }
code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "http://127.0.0.1:$port/origins/spawn_state" || true)
[ "$code" = 401 ] || { echo "BOOT FAIL: unauthenticated spawn_state gave $code (want 401)"; exit 1; }
echo "BOOT OK: $rev listens on a scratch port and answers 401 to an unauthenticated call"
