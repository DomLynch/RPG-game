#!/usr/bin/env bash
# usage: zone1-fairness-l16b.sh <branch> : the L16 probe across era (off/on), the script's swing cadence (20 = kite-farm's stand bot, 25 = the CI test's) and the cap (120 / 180 s)
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin "$1" && git checkout -q -f --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
for era in off on; do for every in 20 25; do for cap in 120 180; do ERA=$era EVERY=$every CAP=$cap node scripts/zone1-fairness-l16.ts 2>&1 | tail -1; done; done; done
