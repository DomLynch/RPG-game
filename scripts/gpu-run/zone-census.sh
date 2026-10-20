#!/usr/bin/env bash
# Zone 1 triangle / draw-call census on the T4: node scripts/gpu-run.mjs <sha with the census hook and these scripts> -- bash scripts/gpu-run/zone-census.sh
set -euo pipefail
npx vite build --minify false --config origins/preview/vite.config.mjs > /tmp/b.log 2>&1 || { tail -20 /tmp/b.log; exit 1; }
mkdir -p artifacts/zone-census
cp scripts/zone-census.mjs ./zone-census-run.mjs
REAL_GPU=1 node ./zone-census-run.mjs . artifacts/zone-census/census.json
