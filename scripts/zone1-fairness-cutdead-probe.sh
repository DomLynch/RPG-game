#!/usr/bin/env bash
# usage: zone1-fairness-cutdead-probe.sh <ref>... : scripts/zone1-fairness-cutdead-probe.ts at each ref (my er86 clone, one job)
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
for REF in "$@"; do
  git checkout -q --detach "$REF" 2>/dev/null || { git fetch -q origin "$REF" 2>/dev/null && git checkout -q --detach FETCH_HEAD; }
  echo "== $(git log -1 --format='%h %cs %s' | cut -c1-90)"
  cp /srv/dev-jobs/er-timings/zone1-fairness-cutdead-probe.ts scripts/
  node scripts/zone1-fairness-cutdead-probe.ts 2>&1 | tail -9
done
