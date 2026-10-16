#!/usr/bin/env bash
# Zone 1 crowd frame-rate on the T4 (launch gate S2): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/crowd-fps.sh [profile]
# Builds the origins preview, then runs scripts/origins-crowd-fps.mjs (0 / 8 / 16 / 40 remote heroes, idle and walking, 1x and 4x CPU, 375x812 touch) against it; the receipt lands in
# artifacts/crowd-fps/receipt.json and comes back with the job. The build must carry #2929 (originsPreview.setOthers).
# `profile`: an UNMINIFIED build (real function names) and a CPU profile per case, 16 and 40 players walking at 1x and 4x; the top self-time functions are in each case's topSelfMs.
set -euo pipefail
if [[ "${1:-}" == "profile" ]]; then
  npx vite build --config origins/preview/vite.config.mjs --minify false > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  SERVE=1 PROFILE=1 COUNTS=0,16,40 MODES=walk THROTTLE=1,4 OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
else
  npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  SERVE=1 THROTTLE=1,4 OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
fi
