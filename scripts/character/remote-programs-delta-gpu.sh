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
    out=$(KITS=none GATE= timeout 300 node scripts/remote-programs-check.mjs "artifacts/dist-$label" "artifacts/out-$label-$i" 2>&1); code=$?
    line=$(printf '%s\n' "$out" | grep -E "^zoneReady:" | head -1)
    if [ -n "$line" ]; then echo "$label#$i $line" | cut -c1-300; else echo "$label#$i NO zoneReady (exit $code); tail:"; printf '%s\n' "$out" | tail -6 | cut -c1-240; fi
  done
done
echo "=== DONE ==="
