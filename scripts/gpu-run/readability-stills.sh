#!/usr/bin/env bash
# Zone 1 phone readability on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/readability-stills.sh
# Builds the page and runs scripts/readability-stills.mjs at 375x812 and 844x390 (the foe, the named creature, a scrub bush, a boulder, a loot drop, the hero: a still each plus overlay and the contrast numbers).
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
mkdir -p artifacts/readability
for v in 375x812 844x390; do VIEW=$v node scripts/readability-stills.mjs artifacts/origins-preview "artifacts/readability/$v" | tee "artifacts/readability/$v.txt" || true; done
