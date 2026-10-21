#!/usr/bin/env bash
# usage: zone1-fairness-kite-bisect.sh <ref>... : Strategy's kite-farm `stand` case (Recruit starter hero, 64 seeds) for cave-troll L3 and goblin L2 at each ref, on my own trunk clone (one job).
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86-trunk
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
for REF in "$@"; do
  git checkout -q --detach "$REF" 2>/dev/null || { git fetch -q origin "$REF" 2>/dev/null && git checkout -q --detach FETCH_HEAD; }
  echo "== $(git log -1 --format='%h %cs %s' | cut -c1-90)"
  for pair in cave-troll:3 goblin:2; do
    KIND="${pair%%:*}" LEVEL="${pair##*:}" CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | grep "^stand" | cut -c1-150
  done
done
