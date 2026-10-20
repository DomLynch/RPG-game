#!/usr/bin/env bash
# Zone-ready A/B on the T4: node scripts/gpu-run.mjs <head sha> -- bash scripts/gpu-run/ready-time.sh <base sha> [runs]
# The head is the job's own checkout (already built by the job setup is NOT assumed: built here); the base is a worktree at <base sha>.
set -euo pipefail
BASE="${1:?base sha}"; RUNS="${2:-3}"
npx vite build --config origins/preview/vite.config.mjs > /tmp/head-build.log 2>&1 || { tail -20 /tmp/head-build.log; exit 1; }
git fetch -q origin "$BASE"
git worktree add -q /tmp/base-wt "$BASE"
ln -s "$PWD/node_modules" /tmp/base-wt/node_modules
(cd /tmp/base-wt && npx vite build --config origins/preview/vite.config.mjs > /tmp/base-build.log 2>&1) || { tail -20 /tmp/base-build.log; exit 1; }
REAL_GPU=1 node scripts/origins-ready-time.mjs /tmp/base-wt "$PWD" "$RUNS"
