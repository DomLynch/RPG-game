#!/usr/bin/env bash
# Zone 1 crowd frame-rate on the T4 (launch gate S2): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/crowd-fps.sh
# Builds the origins preview, then runs scripts/origins-crowd-fps.mjs (8 / 16 / 40 remote heroes, idle and walking, 375x812 touch) against it; the receipt lands in
# artifacts/crowd-fps/receipt.json and comes back with the job. COUNTS, MODES, WINDOW and PASS_FPS pass through. The build must carry #2929 (originsPreview.setOthers).
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
SERVE=1 THROTTLE="${THROTTLE:-1,4}" OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
