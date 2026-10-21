#!/usr/bin/env bash
# Pit 375 before/after stills for "Pit: remove body wound mark": BASE vs AFTER builds, the same goblin spar (real time, so UNMATCHED frames), small jpegs.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 30m -- bash scripts/gpu-run/pit-ab.sh <base sha> <after sha>
set -uo pipefail
BASE="${1:?base sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/pit-ab
cp scripts/gpu-run/pit-best.mjs ./pit-best-run.mjs
for T in base after; do
  if [ $T = base ]; then REF=$BASE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build > "/tmp/bm-$T.log" 2>&1) || { tail -20 "/tmp/bm-$T.log"; exit 1; }
done
for T in base after; do
  echo "######## $T"
  MODE=phone FRAMES=28 STEP_MS=500 REAL_GPU=1 node ./pit-best-run.mjs "/tmp/wt-$T/dist" artifacts/pit-ab "pit375-$T" 2>&1 | grep -E "frames|rror"
done
du -sh artifacts/pit-ab; ls artifacts/pit-ab | wc -l
echo ALLDONE
