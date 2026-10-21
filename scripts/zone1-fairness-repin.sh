#!/usr/bin/env bash
# usage: zone1-fairness-repin.sh <branch> : RV87 re-pin pass on my er86 clone (one job): era fixtures --append, rng fingerprint --update, the ARCHETYPES literal, then the targeted tests; the diff goes to rv87.patch
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin "$1" && git checkout -q -f --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
node scripts/record-era-fixtures.mjs --append 2>&1 | tail -4
node --import ./tests/lib/era-off.ts scripts/rng-fingerprint.mjs --update 2>&1 | tail -3   # the fixture is the legacy (era-off) fingerprint: tests/rng-fingerprint.test.ts imports era-off
node scripts/zone1-fairness-repin.mjs 2>&1 | tail -2   # the helper rides in the branch
FILES="tests/archetype-rows.test.ts tests/level-anchor-rows.test.ts tests/record-version-guard.test.ts tests/record-era-fixtures.test.ts tests/sandbox-era.test.ts tests/rng-fingerprint.test.ts tests/troll-level-fixed.test.ts tests/world-combat-era-on.test.ts tests/interruptible-casts.test.ts tests/player-weapons.test.ts tests/v40-pit-replay.test.ts tests/world-held-heavy.test.ts tests/world-bow-specials.test.ts tests/world-sim-guard.test.ts"
node --test $FILES > /srv/dev-jobs/er-timings/repin.out 2>&1
grep -E "^# (tests|pass|fail)" /srv/dev-jobs/er-timings/repin.out
grep -E "^not ok" /srv/dev-jobs/er-timings/repin.out | cut -c1-200
grep -E "^  error:|^  expected:|^  actual:" /srv/dev-jobs/er-timings/repin.out | cut -c1-300 | head -40
git diff --stat | tail -8
git diff > /srv/dev-jobs/er-timings/rv87.patch
