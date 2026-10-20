#!/usr/bin/env bash
# Zone load-time A/B on the T4 at phone/iPad tier: node scripts/gpu-run.mjs <probe sha> -- env DEVICE=iphone|ipad bash scripts/gpu-run/ready-time.sh <base FULL sha> <head FULL sha> [runs]
# Both sides are built from their own worktree, so the probe branch only supplies this script and the harness.
set -euo pipefail
BASE="${1:?base sha}"; HEAD_SHA="${2:?head sha}"; RUNS="${3:-3}"
for pair in "base:$BASE" "head:$HEAD_SHA"; do
  name="${pair%%:*}"; sha="${pair#*:}"
  git fetch -q origin "$sha"
  git worktree add -q "/tmp/$name-wt" "$sha"
  ln -s "$PWD/node_modules" "/tmp/$name-wt/node_modules"
  (cd "/tmp/$name-wt" && npx vite build --config origins/preview/vite.config.mjs > "/tmp/$name-build.log" 2>&1) || { tail -20 "/tmp/$name-build.log"; exit 1; }
done
REAL_GPU=1 node scripts/origins-ready-time.mjs /tmp/base-wt /tmp/head-wt "$RUNS"
