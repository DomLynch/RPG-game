#!/usr/bin/env bash
# Zone 1 hold-for-heavy on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/zone1-heavy-hold.sh [hold ms] [label]
# Builds the origins preview, then scripts/zone1-heavy-hold-probe.mjs taps, holds and slow-slides STRIKE with real touch events at 375 wide and prints the hero's phases and the foe's hp drop for each.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
REAL_GPU=1 HOLD_MS="${1:-400}" node scripts/zone1-heavy-hold-probe.mjs artifacts/origins-preview "artifacts/gpu-run-stills/${2:-heavy-hold}"
