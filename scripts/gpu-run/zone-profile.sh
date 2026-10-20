#!/usr/bin/env bash
# CPU profile of the Zone 1 page on the T4, two trees: node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/zone-profile.sh <live FULL sha> <sandbox FULL sha> [page query for the sandbox]
# Each tree is built UNMINIFIED (function names readable) in its own worktree, profiled at no throttle and at 4x (REAL_GPU=1).
set -euo pipefail
LIVE="${1:?live sha}"; SANDBOX="${2:?sandbox sha}"; SBPAGE="${3:-/preview/origins/?region=1&zone=1&presence=0&gfx=1}"
cp scripts/zone-profile.mjs /tmp/zone-profile.src.mjs
mkdir -p artifacts/zone-profile
for T in live sandbox; do
  if [ $T = live ]; then REF=$LIVE; else REF=$SANDBOX; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --minify false --config origins/preview/vite.config.mjs > "/tmp/b-$T.log" 2>&1) || { tail -20 "/tmp/b-$T.log"; exit 1; }
done
cp /tmp/zone-profile.src.mjs ./zone-profile-run.mjs
for R in 1 4; do
  REAL_GPU=1 CPU_RATE=$R node ./zone-profile-run.mjs /tmp/wt-live live artifacts/zone-profile
  REAL_GPU=1 CPU_RATE=$R node ./zone-profile-run.mjs /tmp/wt-sandbox sandbox artifacts/zone-profile "$SBPAGE"
done
