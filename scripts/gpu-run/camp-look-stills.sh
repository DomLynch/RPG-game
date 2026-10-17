#!/usr/bin/env bash
# The Cinder Fields camp stills on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/camp-look-stills.sh
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
SWORD_X="${1:--102}" SWORD_Z="${2:-30}" OUT=artifacts/camp-look node scripts/camp-look-stills.mjs   # args: the sword's world x and z in the build under test (default: the place centre, today's row)
