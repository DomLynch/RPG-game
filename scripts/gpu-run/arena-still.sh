#!/usr/bin/env bash
# The GPU proof still: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/arena-still.sh
# Builds the origins preview and takes the 375-wide Zone 1 stills (ready idle, then a three-creature fight) into artifacts/gpu-run-stills/. The still script passes
# --use-angle=swiftshader itself; the runner's Chromium wrapper strips it, so these draw on the T4.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
node scripts/zone1-pack-stills.mjs artifacts/origins-preview artifacts/gpu-run-stills
