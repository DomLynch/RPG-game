#!/usr/bin/env bash
# The on-phone crowd page on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/crowd-page.sh
# Builds the origins preview, loads Zone 1 with ?crowd=16 at 375x812 and checks the fps readout shows 16 drawn; the still and readout come back in artifacts/crowd-page/.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
SERVE=1 OUT=artifacts/crowd-page N=16 node scripts/origins-crowd-page-check.mjs
