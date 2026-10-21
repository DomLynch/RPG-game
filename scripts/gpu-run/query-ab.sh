#!/usr/bin/env bash
# One tree, several URL variants, on a T4 (real GPU), phone tier, 4x CPU, walk and fight, two repeats each:
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/query-ab.sh <tree sha> "<label>|<extra query>" ["<label>|<extra query>" ...]
set -uo pipefail
TREE="${1:?tree sha}"; shift
mkdir -p artifacts/query-ab
cp scripts/zone-profile.mjs /tmp/zone-profile.src.mjs
git fetch -q origin "$TREE"
git worktree add -q /tmp/wt-tree "$TREE"
ln -s "$PWD/node_modules" /tmp/wt-tree/node_modules
(cd /tmp/wt-tree && npx vite build --minify false --config origins/preview/vite.config.mjs > /tmp/b-tree.log 2>&1) || { tail -20 /tmp/b-tree.log; exit 1; }
cp /tmp/zone-profile.src.mjs ./zone-profile-run.mjs
BASE='/preview/origins/?region=1&zone=1&presence=0'
for REP in 1 2; do
  for PH in walk fight; do
    for V in "$@"; do
      L="$V"; case "$V" in hero0) X='&shadowcreatures=0';; hero3) X='';; gfx0) X='&gfx=0';; *) X='';; esac; Q="$BASE$X"   # labels only on the command line (no & or | through the job's shell)
      echo "######## rep $REP $L $PH rate 4"
      REAL_GPU=1 CPU_RATE=4 PHASE=$PH DEVICE=iphone WINDOW_MS=30000 TOP=45 node ./zone-profile-run.mjs /tmp/wt-tree "$L-$PH-r$REP" artifacts/query-ab "$Q" > "artifacts/query-ab/out-$L-$PH-r$REP.txt" 2>&1
      grep -E "^(RENDERER|PROFILE|CASTERS)" "artifacts/query-ab/out-$L-$PH-r$REP.txt"
      grep -E "WebGLShadowMap.render|WebGLRenderer.render |  setProgram" "artifacts/query-ab/out-$L-$PH-r$REP.txt" | head -4
    done
  done
done
echo ALLDONE
