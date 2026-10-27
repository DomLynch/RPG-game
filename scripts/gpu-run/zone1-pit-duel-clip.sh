#!/usr/bin/env bash
# The Pit duel opened from Zone 1, SPECIAL 1 / SPECIAL 2 clips on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/zone1-pit-duel-clip.sh [label]
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
REAL_GPU=1 node scripts/zone1-pit-duel-clip-probe.mjs artifacts/origins-preview "artifacts/gpu-run-stills/${1:-pit-duel-clip}"
