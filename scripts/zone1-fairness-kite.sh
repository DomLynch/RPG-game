#!/usr/bin/env bash
# usage: zone1-fairness-kite.sh <ref>: Strategy's own instrument (scripts/kite-farm.ts, the `stand` case: a Recruit starter hero stands and trades with ONE creature in the real world loop, 64 seeds) for the Zone 1 creatures, at <ref>.
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86-trunk
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
git checkout -q --detach "$1" 2>/dev/null || { git fetch -q origin "$1" 2>/dev/null; git checkout -q --detach FETCH_HEAD; }
echo "head $(git log -1 --format='%h %cs %s' | cut -c1-80)"
for pair in goblin:1 goblin:2 giant-salamander:1 giant-salamander:2 cave-troll:3; do
  echo "== ${pair%%:*} L${pair##*:}"
  KIND="${pair%%:*}" LEVEL="${pair##*:}" CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | tail -4
done
