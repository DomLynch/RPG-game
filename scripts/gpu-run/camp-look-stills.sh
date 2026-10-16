#!/usr/bin/env bash
# The Cinder Fields camp stills on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/camp-look-stills.sh
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
OUT=artifacts/camp-look node scripts/camp-look-stills.mjs
