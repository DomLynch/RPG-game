#!/bin/bash
# The kit warm-up's main-thread cost on the GPU job: node scripts/gpu-run.mjs <sha> -- bash scripts/character/kit-warm-gap-gpu.sh. Builds the Origins preview and runs the remote-heroes row (a signed-out page, 11 bots) three times; each run prints the
# receipt's remoteKitsWarm (failed, warmed, programs, maxLongTaskMs, long tasks, each kit's dress / compile / frames wall ms) and the worst 50 ms-timer gap during the warm and over the whole run. A real GPU does not skip the warm (the slow-device probe).
npx vite build --config origins/preview/vite.config.mjs > /tmp/pv.log 2>&1; echo "PREVIEW-BUILD=$?"
GATE=1 node scripts/remote-programs-check.mjs artifacts/origins-preview artifacts/remote-programs > /tmp/rp.log 2>&1; echo "REMOTE-PROGRAMS exit=$?"   # a remote dressed in each kit after the warm: GATE fails when any kit links a program
node -e "const r=JSON.parse(require('fs').readFileSync('artifacts/remote-programs/receipt.json','utf8')); console.log('RP', JSON.stringify({programsAtReady:r.programsAtReady, totalNew:r.totalNew, kitsWarm:r.kitsWarm && {failed:r.kitsWarm.failed, warmed:r.kitsWarm.warmed, programs:r.kitsWarm.programs}}))"
for i in 1 2 3; do
  node scripts/origins-remote-heroes-check.mjs > /tmp/row-$i.log 2>&1; echo "ROW-$i exit=$?"
  node -e "const r=JSON.parse(require('fs').readFileSync('artifacts/origins-remote-heroes.json','utf8')); console.log('RUN$i', JSON.stringify({pass:r.pass, kits:r.remoteKitsWarm, gapDuringWarm:r.maxGapMsDuringWarm, gapWholeRun:r.maxGapMsWholeRun, added:[r.programsAddedOwned,r.programsAddedUnowned]}))"
done
