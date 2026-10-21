#!/usr/bin/env bash
# usage: zone1-fairness-wsd.sh <branch> : read the new WORLD_DIGEST off tests/world-sim-guard.test.ts at <branch> with PINNED_FOR_VERSION set to the current WORLD_SIM_VERSION (throwaway edit in my er86 clone, one job)
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin "$1" && git checkout -q -f --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
WSV=$(grep -o "WORLD_SIM_VERSION = [0-9]*" src/fight/world-record.ts | grep -o "[0-9]*$")
sed -i "s/^const PINNED_FOR_VERSION = [0-9]*;/const PINNED_FOR_VERSION = $WSV;/" tests/world-sim-guard.test.ts
node --test tests/world-sim-guard.test.ts 2>&1 | grep -E "digest [0-9a-f]{64}|^# (pass|fail)" | cut -c1-320
git checkout -q -f -- tests/world-sim-guard.test.ts
