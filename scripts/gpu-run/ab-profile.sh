#!/usr/bin/env bash
# Paired A/B CPU profile on a T4 (real GPU), phone tier, 4x CPU: walk and fight, BEFORE vs AFTER tree, each built unminified in its own worktree.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/ab-profile.sh <before sha> <after sha>
set -uo pipefail
BEFORE="${1:?before sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/ab-profile
cp scripts/zone-profile.mjs /tmp/zone-profile.src.mjs
for T in before after; do
  if [ $T = before ]; then REF=$BEFORE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --minify false --config origins/preview/vite.config.mjs > "/tmp/b-$T.log" 2>&1) || { tail -20 "/tmp/b-$T.log"; exit 1; }
done
cp /tmp/zone-profile.src.mjs ./zone-profile-run.mjs
for PH in walk fight; do
  for T in before after; do
    echo "######## $T $PH rate 4"
    REAL_GPU=1 CPU_RATE=4 PHASE=$PH DEVICE=iphone WINDOW_MS=30000 TOP=12 node ./zone-profile-run.mjs "/tmp/wt-$T" "$T-$PH" artifacts/ab-profile 2>&1 | grep -E "^(RENDERER|PROFILE|SELF|  +[0-9]+ ms)" | head -16
  done
done
echo ALLDONE
