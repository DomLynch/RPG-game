#!/usr/bin/env bash
# The per-object breakdown of one Zone 1 fight frame on the T4 (the real-GPU tier: a software-GL run picks a lighter tier, so its numbers are not the phone's):
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/frame-breakdown.sh
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
node scripts/frame-breakdown.mjs artifacts/origins-preview artifacts/frame-breakdown --query "&crowd=0" --topn 15
