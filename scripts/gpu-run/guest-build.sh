#!/usr/bin/env bash
# The guest build flow on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/guest-build.sh
# Builds the origins preview and runs scripts/guest-build-check.mjs (nudge line, dialog, place and confirm in memory, reload brings the points back); stills in artifacts/guest-build/.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
node scripts/guest-build-check.mjs artifacts/guest-build
