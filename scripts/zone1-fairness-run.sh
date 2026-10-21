#!/usr/bin/env bash
# VPS runner for scripts/zone1-fairness-batch.ts: my own trunk clone, one job (usage: capture --prio N combat bash /srv/dev-jobs/er-timings/zone1-fairness-run.sh [batch args])
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86-trunk
git fetch -q origin codex/01a09a76/task-1 && git reset -q --hard FETCH_HEAD
echo "head $(git rev-parse --short HEAD)"
cp /srv/dev-jobs/er-timings/zone1-fairness-batch.ts scripts/
node scripts/zone1-fairness-batch.ts "$@"
