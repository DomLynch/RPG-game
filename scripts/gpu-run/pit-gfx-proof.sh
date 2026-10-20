#!/usr/bin/env bash
# The Pit lift's proof on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/pit-gfx-proof.sh [runs]
# Builds the main game (dist/), then scripts/pit-gfx-proof.mjs on the real GPU (REAL_GPU=1) at no throttle and at 4x, into artifacts/pit-gfx/.
set -euo pipefail
npx vite build > /tmp/pit-build.log 2>&1 || { tail -20 /tmp/pit-build.log; exit 1; }
REAL_GPU=1 CPU_RATE=1 node scripts/pit-gfx-proof.mjs artifacts/pit-gfx "${1:-3}"
REAL_GPU=1 CPU_RATE=4 node scripts/pit-gfx-proof.mjs artifacts/pit-gfx "${1:-3}"
