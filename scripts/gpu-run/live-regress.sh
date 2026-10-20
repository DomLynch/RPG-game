#!/usr/bin/env bash
# Load/feel A/B of two builds on the T4: node scripts/gpu-run.mjs <head sha> --timeout 40m -- bash scripts/gpu-run/live-regress.sh <zone|pit> <base FULL sha> [runs]
# The job's own checkout is the HEAD (the measuring script is in it: this branch must contain the sha under test or pass HEADREF); the BASE is a worktree. Builds each, runs scripts/live-regress.mjs on the real GPU.
set -euo pipefail
MODE="${1:?zone|pit}"; BASE="${2:?base sha}"; RUNS="${3:-3}"
build() { if [ "$MODE" = pit ]; then npx vite build > /tmp/b.log 2>&1 || { tail -20 /tmp/b.log; exit 1; }; else npx vite build --config origins/preview/vite.config.mjs > /tmp/b.log 2>&1 || { tail -20 /tmp/b.log; exit 1; }; fi; }
if [ -n "${HEADREF:-}" ]; then git fetch -q origin "$HEADREF"; git checkout -q -f FETCH_HEAD; fi
cp scripts/live-regress.mjs /tmp/live-regress.src.mjs
build
git fetch -q origin "$BASE"
git worktree add -q /tmp/base-wt "$BASE"
ln -s "$PWD/node_modules" /tmp/base-wt/node_modules
(cd /tmp/base-wt && build)
mkdir -p artifacts/live-regress
cp /tmp/live-regress.src.mjs ./live-regress-run.mjs   # next to node_modules, so playwright resolves
REAL_GPU=1 CPU_RATE=1 node ./live-regress-run.mjs "$MODE" /tmp/base-wt "$PWD" "$RUNS" "artifacts/live-regress/$MODE.json"
