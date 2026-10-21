#!/usr/bin/env bash
# Paired longest-task A/B for the wound ray-cast phone skip: BASE vs AFTER, phone UA, CPU x4, real GPU, 3 interleaved reps, plus wound stills.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/wound-ab.sh <base sha> <after sha>
set -uo pipefail
BASE="${1:?base sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/wound-ab
cp scripts/gpu-run/wound-longtask.mjs ./wound-longtask-run.mjs
for T in base after; do
  if [ $T = base ]; then REF=$BASE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --minify false --config origins/preview/vite.config.mjs > "/tmp/b-$T.log" 2>&1) || { tail -20 "/tmp/b-$T.log"; exit 1; }
done
for REP in 1 2 3; do
  for T in base after; do
    echo "######## rep $REP $T"
    REAL_GPU=1 node ./wound-longtask-run.mjs "/tmp/wt-$T" "$T-r$REP" artifacts/wound-ab 4 2>&1 | grep -E "^(RENDERER|LONGTASK)|rror"
  done
done
echo ALLDONE
