#!/usr/bin/env bash
# The weekly sweep of the GPU-only release rows on the Mac (Lead 2026-10-22, docs/ops/gpu-rows-weekly.md). CI never runs them (row-placement.mjs GPU_ONLY:
# they miss the 600 s row ceiling without a GPU) and the nightly CI full run leaves them out, so between diffs that scope them nothing else proves them.
# Mac first per the waterfall, no T4 (spend is Dom's call). Run in a quiet window on a trunk checkout; it writes its own receipt and never touches
# artifacts/release-checks.json (deploy.sh's --full-age reads that file).
#   bash scripts/gpu-rows-weekly.sh            -> artifacts/gpu-rows-weekly.json, exit 1 when a row fails
set -euo pipefail
cd "$(dirname "$0")/.."
max_load=6   # a quiet window (shared-mac skill): the GPU rows time on a real GPU, so a busy Mac reads as a red
load=$(sysctl -n vm.loadavg | awk '{print int($2)}')
if (( load > max_load )); then echo "gpu-rows-weekly: Mac 1-min load $load > $max_load, not a quiet window; try later" >&2; exit 2; fi
rows=$(node --input-type=module -e 'import { GPU_ONLY } from "./scripts/lib/row-placement.mjs"; console.log(GPU_ONLY.join(","))')
echo "gpu-rows-weekly: rows $rows at $(git rev-parse --short=9 HEAD), load $load"
RELEASE_CHECKS_ONLY="$rows" RELEASE_CHECKS_RECEIPT=artifacts/gpu-rows-weekly.json RELEASE_CHECKS_LOG_DIR=artifacts/gpu-rows-weekly RELEASE_CHECK_CONCURRENCY=1 node scripts/release-checks.mjs
