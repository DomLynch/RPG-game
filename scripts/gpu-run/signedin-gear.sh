#!/usr/bin/env bash
# The signed-in dressed-hero row on the T4 (Lead 2026-10-17): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/signedin-gear.sh [stills]
# Builds the origins preview and runs scripts/origins-signedin-gear-check.mjs with the mannequin's synchronous frame budgeted at 50 ms (GEAR_TASK_MS). The runner's Chromium wrapper strips the
# row's software-GL args, so it draws on the T4. The receipt (gearWarm.drawMs, programs before and after the sheet) is artifacts/origins-signedin-gear.json.
# `stills`: also the 375-wide mid-fight still of the signed-in hero (artifacts/gear-stills/signedin-dressed-engage.png).
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
GEAR_STILLS="$([[ "${1:-}" == "stills" ]] && echo artifacts/gear-stills || true)" GEAR_TASK_MS="${GEAR_TASK_MS:-50}" node scripts/origins-signedin-gear-check.mjs
