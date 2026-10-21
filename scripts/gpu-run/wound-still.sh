#!/usr/bin/env bash
# Matched 375 fight stills (jpeg, small) for the wound-ray phone skip: BASE and AFTER, one run each, same style as wound-ab.sh.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 30m -- bash scripts/gpu-run/wound-still.sh <base sha> <after sha>
set -uo pipefail
BASE="${1:?base sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/wound-still
cp scripts/gpu-run/wound-longtask.mjs ./wound-longtask-run.mjs
for T in base after; do
  if [ $T = base ]; then REF=$BASE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --minify false --config origins/preview/vite.config.mjs > "/tmp/b-$T.log" 2>&1) || { tail -20 "/tmp/b-$T.log"; exit 1; }
done
for T in base after; do
  echo "######## $T"
  STILLS=1 REAL_GPU=1 node ./wound-longtask-run.mjs "/tmp/wt-$T" "$T" artifacts/wound-still 4 2>&1 | grep -E "^(RENDERER|LONGTASK)|rror"
done
ls -la artifacts/wound-still
echo ALLDONE
