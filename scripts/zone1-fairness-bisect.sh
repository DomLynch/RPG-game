#!/usr/bin/env bash
# usage: zone1-fairness-bisect.sh <ref>... : the Zone 1 fairness batch (brain policy, troll L3 + scavenger L2) at each ref in turn, on my own er86 clone (one job). Prints one block per ref.
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
for REF in "$@"; do
  git checkout -q --detach "$REF" 2>/dev/null || { git fetch -q origin "$REF" 2>/dev/null; git checkout -q --detach FETCH_HEAD; }
  echo "== $(git log -1 --format='%h %cs %s' | cut -c1-90)"
  cp /srv/dev-jobs/er-timings/zone1-fairness-batch.ts scripts/
  node scripts/zone1-fairness-batch.ts --seeds=48 --seconds=200 --kinds=cave-troll:3:3,goblin:2:2 --policies=brain 2>&1 | tail -3
done
