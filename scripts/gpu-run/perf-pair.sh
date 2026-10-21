#!/usr/bin/env bash
# Paired frame time, the deployed live page against the field06 preview (and any other name=url), on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/perf-pair.sh [name=url ...]
# Default pair: live = https://frankendom.com/preview/origins/?region=1 and field06 = https://frankendom.com/preview/field06/?region=1 (Deploy: guest build, base /preview/field06/). ROUNDS=3, the page alternating, fresh browser each.
set -euo pipefail
ARGS=("$@"); [[ ${#ARGS[@]} -gt 0 ]] || ARGS=("live=https://frankendom.com/preview/origins/?region=1" "field06=https://frankendom.com/preview/field06/?region=1")
mkdir -p artifacts/perf
node scripts/perf-pair.mjs "${ARGS[@]}" | tee artifacts/perf/pair.txt
