#!/usr/bin/env bash
# The launch-plan load test (docs/state/launch-backend.md section 2), run INSIDE a Hugging Face CPU job at one sha, never against production:
#   node scripts/vps-shadow/launch.mjs job <sha40> --lane backend --timeout 40m [--env MODE=presence|writer|all] -- bash scripts/launch-loadtest.sh
# MODE=all (default): writer steps at 10/25/50/100 ops/s (pool 4), 100 ops/s at pool 8 and 16, then presence at 100/250/500/1000 bots (the 10-19 first run).
# MODE=presence: presence only, bots 100/250/500/1000, --layer-cap=100 --max-layers=12 (room for 1,200 players, so 1,000 bots are not cut by a layer limit), FULL output kept in a file and printed.
# It installs PostgreSQL 17 only for the writer modes, runs on a throwaway socket-only cluster, and REFUSES to start if a database or Supabase variable is in the environment.
# Every result block is printed after a `RESULT <name>` line (and, for presence, saved whole under /tmp/loadtest/) so `hf jobs logs` can be cut by it.
set -uo pipefail
if env | grep -qE '^(DATABASE_URL|SUPABASE_[A-Z_]*|PGHOST|PGPASSWORD)='; then echo "REFUSED: a database variable is set; this test uses only a throwaway cluster"; exit 3; fi
MODE="${MODE:-all}"; case "$MODE" in all|presence|writer) ;; *) echo "bad MODE $MODE"; exit 2;; esac
t0=$(date +%s); lap() { echo "LAP $1 $(( $(date +%s) - t0 ))s"; }
export DEBIAN_FRONTEND=noninteractive
echo "HOST mode=$MODE cpus=$(nproc) load=$(cut -d' ' -f1-3 /proc/loadavg) node=$(node -v)"
if [ "$MODE" != presence ]; then
  apt-get install -y -qq postgresql-common >/dev/null 2>&1 && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null 2>&1
  apt-get install -y -qq postgresql-17 >/dev/null 2>&1 || { echo "postgresql-17 install failed"; exit 4; }
  PGB=/usr/lib/postgresql/17/bin; [ -x "$PGB/initdb" ] || { echo "no initdb at $PGB"; exit 4; }
  systemctl stop postgresql >/dev/null 2>&1 || true   # the packaged cluster is not used; the test builds its own in a temp dir
  chown -R postgres "$PWD"; lap pg-installed
  as_pg() { runuser -u postgres -- env PATH="$PATH" PG_BIN="$PGB" "$@"; }
fi
if [ "$MODE" != presence ]; then
  for rate in 10 25 50 100; do
    echo "RESULT writer rate=$rate pool=4"; as_pg node scripts/writer-loadtest.mjs --rate=$rate --seconds=90 --burst=100 --accounts=1000 --warmup=5 --pool=4 2>&1 | tail -60; lap "writer-$rate"
  done
  for pool in 8 16; do
    echo "RESULT writer rate=100 pool=$pool"; as_pg node scripts/writer-loadtest.mjs --rate=100 --seconds=60 --burst=100 --accounts=1000 --warmup=5 --pool=$pool 2>&1 | tail -60; lap "writer-100-pool$pool"
  done
fi
if [ "$MODE" != writer ]; then
  mkdir -p /tmp/loadtest
  maxlayers="${MAXLAYERS:-12}"   # BOTS="1500 2000 3000" MAXLAYERS=40 for the ceiling run (40 layers = room for 4,000 players)
  for bots in ${BOTS:-100 250 500 1000}; do
    echo "RESULT presence bots=$bots cap=100 maxlayers=$maxlayers load=$(cut -d' ' -f1-3 /proc/loadavg)"
    node scripts/presence-loadtest.mjs --bots=$bots --seconds=45 --warmup=5 --layer-cap=100 --max-layers=$maxlayers > "/tmp/loadtest/presence-$bots.txt" 2>&1; echo "presence exit=$?"
    cat "/tmp/loadtest/presence-$bots.txt"; lap "presence-$bots"
  done
fi
echo "DONE $(( $(date +%s) - t0 ))s load=$(cut -d' ' -f1-3 /proc/loadavg)"
