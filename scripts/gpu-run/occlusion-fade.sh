#!/usr/bin/env bash
# The occlusion cutaway's stills and check on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/occlusion-fade.sh
# Builds the origins preview and runs scripts/occlusion-fade-check.mjs; solid ("before", ?occlude=0) and faded ("after") stills, walking and mid-fight, in artifacts/occlusion-fade/.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
node scripts/occlusion-fade-check.mjs artifacts/occlusion-fade
