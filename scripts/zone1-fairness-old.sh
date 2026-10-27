#!/usr/bin/env bash
# usage: zone1-fairness-old.sh <ref> [batch args]: the same batch on an older tree (my own er86 clone, one job), to see whether a number moved with the sim
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
REF="$1"; shift
git fetch -q origin "$REF" 2>/dev/null; git checkout -q --detach "$REF" 2>&1 || git checkout -q --detach FETCH_HEAD
echo "head $(git rev-parse --short HEAD)"
cp /srv/dev-jobs/er-timings/zone1-fairness-batch.ts scripts/
node scripts/zone1-fairness-batch.ts "$@"
