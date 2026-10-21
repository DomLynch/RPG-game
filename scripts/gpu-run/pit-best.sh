#!/usr/bin/env bash
# Pit stills at the fight camera, 375 phone and 1280x800 desktop, for "does the body wound mark add value" (no debug overlay, no signature flag): small jpegs, one frame every 500 ms of a goblin spar.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 30m -- bash scripts/gpu-run/pit-best.sh <build sha>
set -uo pipefail
REF="${1:?build sha}"
mkdir -p artifacts/pit-best
cp scripts/gpu-run/pit-best.mjs ./pit-best-run.mjs
git fetch -q origin "$REF"
git worktree add -q /tmp/wt-b "$REF"
ln -s "$PWD/node_modules" /tmp/wt-b/node_modules
(cd /tmp/wt-b && npx vite build > /tmp/bm.log 2>&1) || { tail -20 /tmp/bm.log; exit 1; }
for MODE in phone desktop; do
  echo "######## $MODE"
  MODE=$MODE FRAMES=30 STEP_MS=500 REAL_GPU=1 node ./pit-best-run.mjs /tmp/wt-b/dist artifacts/pit-best "pit-$MODE" 2>&1 | grep -E "frames|rror"
done
du -sh artifacts/pit-best; ls artifacts/pit-best | wc -l
echo ALLDONE
