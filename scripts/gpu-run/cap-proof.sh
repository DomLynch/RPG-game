#!/usr/bin/env bash
# #3463 phone-cap proof on the T4: node scripts/gpu-run.mjs <probe sha> --timeout 40m -- bash scripts/gpu-run/cap-proof.sh <before FULL sha> <after FULL sha>
# Builds both trees unminified, takes the 375 phone-tier camp still of each, then the iPhone-tier profile (no throttle and 4x) of each.
set -euo pipefail
BEFORE="${1:?before sha}"; AFTER="${2:?after sha}"
cp scripts/zone-profile.mjs /tmp/zone-profile.src.mjs
cp scripts/cap-still.mjs /tmp/cap-still.src.mjs
mkdir -p artifacts/cap-proof
for T in before after; do
  if [ $T = before ]; then REF=$BEFORE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --minify false --config origins/preview/vite.config.mjs > "/tmp/b-$T.log" 2>&1) || { tail -20 "/tmp/b-$T.log"; exit 1; }
done
cp /tmp/zone-profile.src.mjs ./zone-profile-run.mjs
cp /tmp/cap-still.src.mjs ./cap-still-run.mjs
for T in before after; do REAL_GPU=1 node ./cap-still-run.mjs "/tmp/wt-$T" "$T" artifacts/cap-proof; done
for R in 1 4; do
  for T in before after; do REAL_GPU=1 DEVICE=iphone CPU_RATE=$R node ./zone-profile-run.mjs "/tmp/wt-$T" "$T" artifacts/cap-proof; done
done
