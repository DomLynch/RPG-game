#!/usr/bin/env bash
# The GPU proof still for one zone: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/zone-still.sh <zone id>
# Builds the origins preview and takes the 375-wide stills of /zone/<id>/ (ready idle, then mid-fight) into artifacts/gpu-run-stills/. Same runner and rules as arena-still.sh.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
node scripts/zone1-pack-stills.mjs artifacts/origins-preview artifacts/gpu-run-stills "${1:?a zone id}"
