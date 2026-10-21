#!/usr/bin/env bash
# usage: zone1-fairness-gates.sh <branch> : the as-data gate and tsc at <branch> (my er86 clone, one job), plus the final before/after kite-farm table at the branch's own rows
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin "$1" && git checkout -q -f --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
node scripts/check-as-data.mjs --gate > /tmp/z1asdata.out 2>&1; echo "as-data exit $?"; tail -3 /tmp/z1asdata.out | cut -c1-200
npx tsc --noEmit > /tmp/z1tsc.out 2>&1; echo "tsc exit $?"; tail -3 /tmp/z1tsc.out | cut -c1-200
echo "== AFTER (this branch's rows, kite-farm stand, 64 seeds)"
for pair in wolf:1 wolf:2 giant-salamander:1 giant-salamander:2 cave-troll:3 goblin:1 goblin:2; do
  echo "$pair: $(KIND="${pair%%:*}" LEVEL="${pair##*:}" CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/, killed while.*mean time to kill/ ... ttk/' | cut -c1-140)"
done
echo "geared L16 rung 4: $(HERO_LEVEL=16 HERO_RUNG=4 KIND=cave-troll LEVEL=3 CASES=stand SEEDS=32 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/, killed while.*mean time to kill/ ... ttk/' | cut -c1-140)"
SHA=$(git rev-parse HEAD)
git fetch -q origin release-K6p2 && git checkout -q -f --detach FETCH_HEAD && git checkout -q "$SHA" -- scripts/kite-farm.ts   # the same instrument, the K6p2 rows
echo "== BEFORE (release-K6p2 rows, same kite-farm)"
for pair in wolf:1 wolf:2 giant-salamander:1 giant-salamander:2 cave-troll:3 goblin:1 goblin:2; do
  echo "$pair: $(KIND="${pair%%:*}" LEVEL="${pair##*:}" CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/, killed while.*mean time to kill/ ... ttk/' | cut -c1-140)"
done
echo "geared L16 rung 4: $(HERO_LEVEL=16 HERO_RUNG=4 KIND=cave-troll LEVEL=3 CASES=stand SEEDS=32 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/, killed while.*mean time to kill/ ... ttk/' | cut -c1-140)"
git checkout -q -f -- scripts/kite-farm.ts
