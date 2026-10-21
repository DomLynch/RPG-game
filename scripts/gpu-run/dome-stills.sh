#!/usr/bin/env bash
# The Zone 1 start view before and after the banner-free dome pictures, on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/dome-stills.sh 844x390 [932x430 ...]
# "after" = this head's public/zones pictures; "before" = the trunk's (origin/codex/01a09a76/task-1). Web's start-view flow (scripts/dome-start-stills.mjs: worldfight zone=1 presence=0, iPhone UA, the first scavenger, 2.5 m short).
# Writes artifacts/dome/<before|after>-<WxH>/walk.jpg (and fight.jpg). Images ride the job log smallest first, about 2.5 MB: two sizes per job.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-after > /tmp/b-after.log 2>&1 || { tail -20 /tmp/b-after.log; exit 1; }
git fetch -q origin codex/01a09a76/task-1 && git checkout -q FETCH_HEAD -- public/zones
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-before > /tmp/b-before.log 2>&1 || { tail -20 /tmp/b-before.log; exit 1; }
for v in "$@"; do
  for b in after before; do SETTLE=15000 VIEW=$v node scripts/dome-start-stills.mjs "/tmp/d-$b" "artifacts/dome/$b-$v"; done
done
