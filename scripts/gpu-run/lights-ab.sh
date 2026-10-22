#!/usr/bin/env bash
# The point-lights A/B on the T4, arms ALTERNATING INSIDE THIS ONE JOB (a T4's absolute timing differs 2x between jobs; only pairs in one job mean anything):
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/lights-ab.sh [pairs]
# A = the torchLights row's default (every camp fire lit), B = ?torchlights=4 (the 4 nearest). Each cell: a fresh phone context (iPhone UA, DPR 3, landscape), load, 5 s idle, 30 s walk, 15 s fight, at CPU x1 and x4.
# Reads artifacts/lights-ab/p<k><A|B>/*.json; scripts/lights-ab-pairs.mjs prints the paired table.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
for k in $(seq 1 "${1:-4}"); do
  for arm in A B; do
    q=""; [[ "$arm" == B ]] && q="&torchlights=4"
    node scripts/lights-ab-probe.mjs "artifacts/lights-ab/p${k}${arm}" local --dist artifacts/origins-preview --orient landscape --throttle 1,4 --phases idle,walk,fight --query "$q" 2>&1 | grep -E "^PERF" | cut -c1-400 || true
  done
done
node scripts/lights-ab-pairs.mjs artifacts/lights-ab
