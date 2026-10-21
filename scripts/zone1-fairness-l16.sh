#!/usr/bin/env bash
# usage: zone1-fairness-l16.sh <branch> : scripts/zone1-fairness-l16.ts at <branch> under era off / on, cap 120 and 300 s (my er86 clone, one job)
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin "$1" && git checkout -q -f --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
for era in off on; do for cap in 120 300; do ERA=$era CAP=$cap node scripts/zone1-fairness-l16.ts 2>&1 | tail -1; done; done
