#!/bin/bash
# The profile of the kit warm's long tasks on the GPU job: node scripts/gpu-run.mjs <sha> -- bash scripts/character/kit-warm-trace-gpu.sh. An UNMINIFIED preview build (function names), three runs; each prints the long tasks and the functions inside them.
# The dist path is absolute (vite resolves a relative --outDir against the config's root, not the cwd).
npx vite build --config origins/preview/vite.config.mjs --minify false --outDir "$PWD/artifacts/origins-preview-trace" > /tmp/pv.log 2>&1; echo "PREVIEW-BUILD=$?"
for i in 1 2 3; do
  echo "=== TRACE RUN $i"
  node scripts/character/kit-warm-trace.mjs "$PWD/artifacts/origins-preview-trace" 2>&1 | head -80
done
