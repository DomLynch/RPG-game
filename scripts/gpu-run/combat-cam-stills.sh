#!/usr/bin/env bash
# The wide combat camera's stills on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/combat-cam-stills.sh [before]
# Builds the origins preview and takes the 375x812 ready-idle and mid-fight stills (and the 812x375 pair) into artifacts/combat-cam/. `before` adds ?combatcam=0: the walking camera in a fight.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
export COMBATCAM="$([[ "${1:-}" == "before" ]] && echo 0 || true)"
node scripts/combat-cam-stills.mjs artifacts/combat-cam portrait
node scripts/combat-cam-stills.mjs artifacts/combat-cam landscape
