#!/usr/bin/env bash
# usage: zone1-fairness-suite.sh <branch> [test files...] : the unit suite (or just the named files) at <branch> on my own er86 clone (one job); prints the failing test names and the summary counts
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
BR="$1"; shift
git fetch -q origin "$BR" && git checkout -q --detach FETCH_HEAD
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
if [ "$#" -gt 0 ]; then node --test "$@" > /tmp/z1suite.out 2>&1; else node --test --test-skip-pattern="\\[slow\\]" tests/*.test.ts > /tmp/z1suite.out 2>&1; fi
echo "exit $?"
grep -E "^# (tests|pass|fail|skipped)" /tmp/z1suite.out
grep -E "^not ok|^    not ok|^        not ok" /tmp/z1suite.out | head -60 | cut -c1-200
cp /tmp/z1suite.out /srv/dev-jobs/er-timings/z1suite.full.out
