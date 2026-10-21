#!/usr/bin/env bash
# usage: zone1-fairness-cutdead.sh <ref>... : origins/preview/world-combat.test.ts run DIRECTLY (era on, the live rules; CI runs it only era-off via tests/origins-world-combat.test.ts) at each ref, on my own er86 clone (one job).
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
for REF in "$@"; do
  git checkout -q --detach "$REF" 2>/dev/null || { git fetch -q origin "$REF" 2>/dev/null && git checkout -q --detach FETCH_HEAD; }
  echo "== $(git log -1 --format='%h %cs %s' | cut -c1-90)"
  node --test origins/preview/world-combat.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|^not ok|^    not ok|^ok " | head -12
done
