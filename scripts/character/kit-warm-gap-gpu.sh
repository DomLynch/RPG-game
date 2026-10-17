#!/bin/bash
# The kit warm-up's main-thread cost on the GPU job: node scripts/gpu-run.mjs <sha> -- bash scripts/character/kit-warm-gap-gpu.sh. Builds the Origins preview and runs the remote-heroes row (a signed-out page, 11 bots) three times; each run prints the
# receipt's remoteKitsWarm (failed, warmed, programs, maxLongTaskMs, long tasks, each kit's dress / compile / frames wall ms) and the worst 50 ms-timer gap during the warm and over the whole run. A real GPU does not skip the warm (the slow-device probe).
npx vite build --config origins/preview/vite.config.mjs > /tmp/pv.log 2>&1; echo "PREVIEW-BUILD=$?"
for i in 1 2 3; do
  node scripts/origins-remote-heroes-check.mjs > /tmp/row-$i.log 2>&1; echo "ROW-$i exit=$?"
  node -e "const r=JSON.parse(require('fs').readFileSync('artifacts/origins-remote-heroes.json','utf8')); console.log('RUN$i', JSON.stringify({pass:r.pass, kits:r.remoteKitsWarm, gapDuringWarm:r.maxGapMsDuringWarm, gapWholeRun:r.maxGapMsWholeRun, added:[r.programsAddedOwned,r.programsAddedUnowned]}))"
done
