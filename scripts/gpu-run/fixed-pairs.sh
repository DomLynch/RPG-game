#!/usr/bin/env bash
# Matched-frame stills for the wound-ray phone skip, ONE T4 job: zone fight (origins preview) and Pit signature burst, base vs after, fixed clock + seeded Math.random.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/fixed-pairs.sh <base sha> <after sha>
set -uo pipefail
BASE="${1:?base sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/fixed-pairs
cp scripts/gpu-run/wound-fixed.mjs ./wound-fixed-run.mjs
cp scripts/gpu-run/pit-sig-fixed.mjs ./pit-sig-fixed-run.mjs
for T in base after; do
  if [ $T = base ]; then REF=$BASE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --config origins/preview/vite.config.mjs > "/tmp/bo-$T.log" 2>&1 && npx vite build > "/tmp/bm-$T.log" 2>&1) || { tail -20 "/tmp/bo-$T.log" "/tmp/bm-$T.log"; exit 1; }
done
for T in base after; do
  echo "######## $T zone"
  REAL_GPU=1 node ./wound-fixed-run.mjs "/tmp/wt-$T" "$T" artifacts/fixed-pairs 2>&1 | grep -E "FIXED|rror"
  echo "######## $T pit"
  REAL_GPU=1 node ./pit-sig-fixed-run.mjs "/tmp/wt-$T/dist" artifacts/fixed-pairs "pit-$T" 2>&1 | grep -E "FIXED|rror"
done
du -sh artifacts/fixed-pairs; ls artifacts/fixed-pairs | wc -l
echo ALLDONE
