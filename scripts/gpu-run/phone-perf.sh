#!/usr/bin/env bash
# Zone 1 phone-tier perf on the T4: node scripts/gpu-run.mjs <sha> --timeout 40m -- bash scripts/gpu-run/phone-perf.sh
# Pass 1 (live): https://frankendom.com/zone1/ as a player gets it (minified, on the wire), portrait + landscape, CPU x1 and x4: load + frames + long tasks + renderer.info.
# Pass 2 (local): the same sha built UNMINIFIED, same matrix, with a CPU profile per phase (named functions). Reports go to artifacts/gpu-run-stills/phone-perf/ and each run prints a PERF line.
set -uo pipefail
OUT=artifacts/gpu-run-stills/phone-perf
mkdir -p "$OUT"
export REAL_GPU=1
node scripts/phone-perf-probe.mjs "$OUT/live" live --throttle 1,4 --orient portrait,landscape 2>&1 | grep -E 'PERF|rror' | cut -c1-900
npx vite build --config origins/preview/vite.config.mjs --minify false --outDir artifacts/origins-preview-unmin > /tmp/origins-build-unmin.log 2>&1 || { tail -20 /tmp/origins-build-unmin.log; exit 1; }
node scripts/phone-perf-probe.mjs "$OUT/local" local --dist artifacts/origins-preview-unmin --throttle 1,4 --orient portrait,landscape --profile 2>&1 | grep -E 'PERF|rror' | cut -c1-900
ls -la "$OUT"/*/ | head -30
