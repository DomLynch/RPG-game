#!/usr/bin/env bash
# Post-stack cost on a T4 (real GPU), phone tier, 4x CPU: ONE tree (<sha>) with the graphics lift on (default) vs off (?gfx=0), walk and fight, two repeats.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/gfx-ab.sh <tree sha>
set -uo pipefail
TREE="${1:?tree sha}"
mkdir -p artifacts/gfx-ab
cp scripts/zone-profile.mjs /tmp/zone-profile.src.mjs
git fetch -q origin "$TREE"
git worktree add -q /tmp/wt-tree "$TREE"
ln -s "$PWD/node_modules" /tmp/wt-tree/node_modules
(cd /tmp/wt-tree && npx vite build --minify false --config origins/preview/vite.config.mjs > /tmp/b-tree.log 2>&1) || { tail -20 /tmp/b-tree.log; exit 1; }
cp /tmp/zone-profile.src.mjs ./zone-profile-run.mjs
BASE='/preview/origins/?region=1&zone=1&presence=0'
for REP in 1 2; do
  for PH in walk fight; do
    for V in on off; do
      Q="$BASE"; [ $V = off ] && Q="$BASE&gfx=0"
      echo "######## rep $REP gfx-$V $PH rate 4"
      REAL_GPU=1 CPU_RATE=4 PHASE=$PH DEVICE=iphone WINDOW_MS=30000 TOP=45 node ./zone-profile-run.mjs /tmp/wt-tree "gfx$V-$PH-r$REP" artifacts/gfx-ab "$Q" > "artifacts/gfx-ab/out-$V-$PH-r$REP.txt" 2>&1
      grep -E "^(RENDERER|PROFILE)" "artifacts/gfx-ab/out-$V-$PH-r$REP.txt"
      grep -E "WebGLShadowMap.render|WebGLRenderer.render |  setProgram|OutputPass|gfx-lift" "artifacts/gfx-ab/out-$V-$PH-r$REP.txt" | head -8
    done
  done
done
echo ALLDONE
