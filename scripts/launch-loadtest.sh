#!/usr/bin/env bash
# The launch-plan load test (docs/state/launch-backend.md section 2), run INSIDE a Hugging Face CPU job at one sha, never against production:
#   node scripts/vps-shadow/launch.mjs job <sha40> --lane backend --timeout 40m [--env MODE=presence|writer|all] -- bash scripts/launch-loadtest.sh
# MODE=all (default): writer steps at 10/25/50/100 ops/s (pool 4), 100 ops/s at pool 8 and 16, then presence at 100/250/500/1000 bots (the 10-19 first run).
# MODE=presence: presence only, bots 100/250/500/1000, --layer-cap=100 --max-layers=12 (room for 1,200 players, so 1,000 bots are not cut by a layer limit), FULL output kept in a file and printed.
# It installs PostgreSQL 17 only for the writer modes, runs on a throwaway socket-only cluster, and REFUSES to start if a database or Supabase variable is in the environment.
# Every result block is printed after a `RESULT <name>` line (and, for presence, saved whole under /tmp/loadtest/) so `hf jobs logs` can be cut by it.
set -uo pipefail
if env | grep -qE '^(DATABASE_URL|SUPABASE_[A-Z_]*|PGHOST|PGPASSWORD)='; then echo "REFUSED: a database variable is set; this test uses only a throwaway cluster"; exit 3; fi
MODE="${MODE:-all}"; case "$MODE" in all|presence|writer|verify|mix) ;; *) echo "bad MODE $MODE"; exit 2;; esac
if [ "$MODE" = verify ]; then   # the replay-verification pool under load: no database, no PG install (scripts/verify-loadtest.mjs --grid)
  echo "HOST mode=verify cpus=$(nproc) load=$(cut -d' ' -f1-3 /proc/loadavg) node=$(node -v)"
  echo "RESULT verify grid"; node scripts/verify-loadtest.mjs --grid --seconds=30 2>&1; echo "verify exit=$?"
  echo "DONE load=$(cut -d' ' -f1-3 /proc/loadavg)"; exit 0
fi
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
if [ "$MODE" = mix ]; then   # the writer + world-kill mix (scripts/writer-mix-loadtest.mjs), each phase stops at its first break (a 5xx or a p95 over 500 ms)
  for rate in 200 400 800; do
    echo "RESULT mix real-set rate=$rate pool=4"; as_pg node scripts/writer-mix-loadtest.mjs --rate=$rate --seconds=60 --accounts=1000 --pool=4 --kill-share=0.1 2>&1 | tee /tmp/mix.out | tail -95; lap "mix-real-$rate"
    grep -q "^writer-mix-loadtest: .*BROKE" /tmp/mix.out && { echo "STOP real-set phase at rate=$rate (broke)"; break; }
  done
  for rate in 20 50 100; do
    echo "RESULT mix clones=1000 cycles/s=$rate pool=4"; as_pg node scripts/writer-mix-loadtest.mjs --rate=$rate --seconds=30 --accounts=1000 --pool=4 --kill-share=1 --clones=1000 2>&1 | tee /tmp/mix.out | tail -95; lap "mix-clones-$rate"
    grep -q "^writer-mix-loadtest: .*BROKE" /tmp/mix.out && { echo "STOP clone phase at cycles/s=$rate (broke)"; break; }
  done
  echo "DONE $(( $(date +%s) - t0 ))s load=$(cut -d' ' -f1-3 /proc/loadavg)"; exit 0
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
  # The load test's bots all come from one loopback address, and the presence service's TEST mode caps one address at the testIpSockets row (1,000): a run over 1,000 bots needs that row raised IN THIS
  # JOB'S COPY ONLY (never committed; production keys sockets by the real client address, 8 each). TEST_IP_SOCKETS=5000 does it and the run's header says so.
  if [ -n "${TEST_IP_SOCKETS:-}" ]; then sed -i "s/\"id\": \"testIpSockets\", \"value\": [0-9]*/\"id\": \"testIpSockets\", \"value\": ${TEST_IP_SOCKETS}/" origins/presence/presence-rules-defs.json; echo "NOTE testIpSockets raised to ${TEST_IP_SOCKETS} in this job's copy (load-test bots share one address)"; fi
  maxlayers="${MAXLAYERS:-12}"   # BOTS="1500 2000 3000" MAXLAYERS=40 for the ceiling run (40 layers = room for 4,000 players)
  for bots in ${BOTS:-100 250 500 1000}; do
    echo "RESULT presence bots=$bots cap=100 maxlayers=$maxlayers load=$(cut -d' ' -f1-3 /proc/loadavg)"
    node scripts/presence-loadtest.mjs --bots=$bots --seconds=45 --warmup=5 --layer-cap=100 --max-layers=$maxlayers > "/tmp/loadtest/presence-$bots.txt" 2>&1; echo "presence exit=$?"
    cat "/tmp/loadtest/presence-$bots.txt"; lap "presence-$bots"
  done
fi
echo "DONE $(( $(date +%s) - t0 ))s load=$(cut -d' ' -f1-3 /proc/loadavg)"
