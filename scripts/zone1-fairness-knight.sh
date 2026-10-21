#!/usr/bin/env bash
# usage: zone1-fairness-knight.sh : kite-farm `stand` (64 seeds) for the knight at L1, L3, L6 on trunk (my trunk clone, one job): a report row, no retune
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86-trunk
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
git checkout -q -f --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %cs %s' | cut -c1-80)"
for level in 1 3 6; do
  echo "knight L$level: $(KIND=knight LEVEL=$level CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/, killed while.*mean time to kill/ ... ttk/' | cut -c1-140)"
done
