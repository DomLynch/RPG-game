#!/usr/bin/env bash
# The GPU proof still of a picked-up weapon in the world fight: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/weapon-still.sh <weapon id, e.g. knife>
# Builds the origins preview and takes the 375-wide stills of Zone 1 with the hero wielding that weapon (ready idle, then mid-fight) into artifacts/gpu-run-stills/. Same runner and rules as zone-still.sh.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
WEAPON="${1:?a weapon id}" node scripts/zone1-weapon-stills.mjs artifacts/origins-preview artifacts/gpu-run-stills
