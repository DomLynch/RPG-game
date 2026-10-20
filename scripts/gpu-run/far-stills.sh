#!/usr/bin/env bash
# Item C stills on the T4: node scripts/gpu-run.mjs <probe sha> --timeout 40m -- bash scripts/gpu-run/far-stills.sh <FULL sha of the tree to build>
set -euo pipefail
TREE="${1:?tree sha}"
cp scripts/far-detail-stills.mjs /tmp/far-detail-stills.src.mjs
mkdir -p artifacts/far-stills
git fetch -q origin "$TREE"
git worktree add -q /tmp/wt-tree "$TREE"
ln -s "$PWD/node_modules" /tmp/wt-tree/node_modules
(cd /tmp/wt-tree && npx vite build --config origins/preview/vite.config.mjs > /tmp/b-tree.log 2>&1) || { tail -20 /tmp/b-tree.log; exit 1; }
cp /tmp/far-detail-stills.src.mjs ./far-detail-stills-run.mjs
REAL_GPU=1 node ./far-detail-stills-run.mjs /tmp/wt-tree artifacts/far-stills
