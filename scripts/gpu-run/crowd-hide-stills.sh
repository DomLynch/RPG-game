#!/usr/bin/env bash
# TEST ONLY (never merged): before/after stills of 40 remote heroes (4 full, the rest cheap) at 375x812 on the T4: the remote-cheap row OFF (empty list) vs ON.
set -euo pipefail
node scripts/gpu-run/patch-crowdstills.cjs
RULES_JSON='{"remoteFullCount":4,"remoteAdaptFullCount":4,"remoteAdaptSlowMs":100000}'
cp origins/preview/remote-cheap.json /tmp/remote-cheap.on.json
build() { npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }; }
# BEFORE: the row emptied
echo '{"remoteCheap":[{"id":"cheap","fields":{"hideParts":[]}}]}' > origins/preview/remote-cheap.json
build; SERVE=1 OUT=artifacts/crowd-hide/before N=40 RULES="$RULES_JSON" node scripts/origins-crowd-page-check.mjs || true
# AFTER: the row as committed
cp /tmp/remote-cheap.on.json origins/preview/remote-cheap.json
build; SERVE=1 OUT=artifacts/crowd-hide/after N=40 RULES="$RULES_JSON" node scripts/origins-crowd-page-check.mjs || true
echo HIDE-STILLS-DONE
