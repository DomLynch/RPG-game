#!/usr/bin/env bash
# Only the framing-matched near/far stills of the kit LOD swap (swap on vs ?kitlod=0): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/kit-lod-stills.sh
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
node scripts/kit-lod-stills.mjs artifacts/origins-preview artifacts/kit-lod/stills 2>&1 | tail -3 | cut -c1-400
