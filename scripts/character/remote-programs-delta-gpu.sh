#!/bin/bash
# [zone ready] at 375 on the T4, BASE vs HEAD, the order alternating (node scripts/gpu-run.mjs <this branch's sha> -- env BASE=<sha> HEAD=<sha> RUNS=3 bash scripts/character/remote-programs-delta-gpu.sh).
# The job clones this branch; BASE and HEAD are fetched by sha, each built into its own dist, and HEAD's scripts/remote-programs-check.mjs (not on trunk) drives both.
set -uo pipefail
: "${BASE:?}" "${HEAD:?}"
git fetch -q origin "$HEAD" "$BASE" || { echo "BLOCKER fetch of $HEAD / $BASE failed"; exit 12; }
git show "$HEAD:scripts/remote-programs-check.mjs" > /tmp/check.mjs || exit 12
for pair in "base:$BASE" "head:$HEAD"; do
  label=${pair%%:*}; sha=${pair#*:}
  git checkout -q "$sha" || exit 12
  rm -rf "artifacts/dist-$label"; npx vite build --config origins/preview/vite.config.mjs --outDir "artifacts/dist-$label" > "/tmp/build-$label.log" 2>&1; echo "BUILD-$label=$? $(git rev-parse --short HEAD)"
done
git checkout -q "$HEAD"; cp /tmp/check.mjs scripts/remote-programs-check.mjs
for i in $(seq 1 "${RUNS:-3}"); do
  if (( i % 2 )); then order="base head"; else order="head base"; fi
  for label in $order; do
    KITS=none GATE= node scripts/remote-programs-check.mjs "artifacts/dist-$label" "artifacts/out-$label-$i" 2>&1 | grep -E "^zoneReady:" | sed "s/^/$label#$i /" | cut -c1-300
  done
done
echo "=== DONE ==="
