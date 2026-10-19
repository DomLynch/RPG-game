#!/usr/bin/env bash
# The launch-plan load test (docs/state/launch-backend.md section 2), run INSIDE a Hugging Face CPU job at one sha, never against production:
#   node scripts/vps-shadow/launch.mjs job <sha40> --lane backend --timeout 40m -- bash scripts/launch-loadtest.sh
# It installs PostgreSQL 17 (the production major), then runs scripts/writer-loadtest.mjs (a throwaway socket-only cluster, the real writer, a fake Auth table) at 10/25/50/100 ops/s,
# re-runs the top rate at pool 8 and 16, then scripts/presence-loadtest.mjs at 100/250/500/1000 bots. Every result block is printed after a `RESULT <name>` line so `hf jobs logs` can be cut by it.
# It refuses to start if a database or Supabase variable is in the environment: nothing here may point at a real host.
set -uo pipefail
if env | grep -qE '^(DATABASE_URL|SUPABASE_[A-Z_]*|PGHOST|PGPASSWORD)='; then echo "REFUSED: a database variable is set; this test uses only a throwaway cluster"; exit 3; fi
t0=$(date +%s); lap() { echo "LAP $1 $(( $(date +%s) - t0 ))s"; }
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq postgresql-common >/dev/null 2>&1 && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null 2>&1
apt-get install -y -qq postgresql-17 >/dev/null 2>&1 || { echo "postgresql-17 install failed"; exit 4; }
PGB=/usr/lib/postgresql/17/bin; [ -x "$PGB/initdb" ] || { echo "no initdb at $PGB"; exit 4; }
systemctl stop postgresql >/dev/null 2>&1 || true   # the packaged cluster is not used; the test builds its own in a temp dir
chown -R postgres "$PWD"; lap pg-installed
echo "HOST cpus=$(nproc) load=$(cut -d' ' -f1-3 /proc/loadavg) node=$(node -v) pg=$($PGB/postgres --version)"
as_pg() { runuser -u postgres -- env PATH="$PATH" PG_BIN="$PGB" "$@"; }
for rate in 10 25 50 100; do
  echo "RESULT writer rate=$rate pool=4"; as_pg node scripts/writer-loadtest.mjs --rate=$rate --seconds=90 --burst=100 --accounts=1000 --warmup=5 --pool=4 2>&1 | tail -60; lap "writer-$rate"
done
for pool in 8 16; do
  echo "RESULT writer rate=100 pool=$pool"; as_pg node scripts/writer-loadtest.mjs --rate=100 --seconds=60 --burst=100 --accounts=1000 --warmup=5 --pool=$pool 2>&1 | tail -60; lap "writer-100-pool$pool"
done
for bots in 100 250 500 1000; do
  echo "RESULT presence bots=$bots"; node scripts/presence-loadtest.mjs --bots=$bots --seconds=45 --warmup=5 2>&1 | tail -40; lap "presence-$bots"
done
echo "DONE $(( $(date +%s) - t0 ))s load=$(cut -d' ' -f1-3 /proc/loadavg)"
