#!/usr/bin/env bash
# The Pit lift's cost read plus its 375 still bursts, one T4 job: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/pit-gfx-stills.sh [runs]
# pit-gfx-proof.sh (build, then the cost pair at no throttle and 4x), then pit-gfx-frames.mjs on the same dist with the lift on and with ?gfx=0.
set -euo pipefail
bash scripts/gpu-run/pit-gfx-proof.sh "${1:-3}"
REAL_GPU=1 node scripts/pit-gfx-frames.mjs dist artifacts/pit-gfx-stills on-375
REAL_GPU=1 node scripts/pit-gfx-frames.mjs dist artifacts/pit-gfx-stills off-375 gfx0
