#!/usr/bin/env bash
# The Zone 1 combat camera at several screen sizes, before (camLZoom 0.85, the trunk row) and after (this head's row), on the T4:
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/landscape-cam-stills.sh [after:844x390 before:1366x1024 ...]   (no args = all five sizes, both)
# Writes artifacts/landscape-cam/{before,after}-<WxH>/fight.png. The log carries about 2.5 MB of images back, so the two iPad sizes go in their own jobs.
set -euo pipefail
DEFS=origins/preview/preview-rules-defs.json
PAIRS=("$@"); if [[ ${#PAIRS[@]} -eq 0 ]]; then for b in after before; do for v in 844x390 932x430 1366x1024 1180x820 375x812; do PAIRS+=("$b:$v"); done; done; fi
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-after > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
cp "$DEFS" /tmp/defs.after
sed -i 's/"id": "camLZoom", "value": [0-9.]*/"id": "camLZoom", "value": 0.85/' "$DEFS"
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-before > /tmp/origins-build2.log 2>&1 || { tail -20 /tmp/origins-build2.log; exit 1; }
cp /tmp/defs.after "$DEFS"
mkdir -p artifacts/landscape-cam
for p in "${PAIRS[@]}"; do
  b=${p%%:*}; v=${p##*:}
  VIEW=$v WAIT=8000 node scripts/cam-close-stills.mjs "/tmp/d-$b" "artifacts/landscape-cam/$b-$v"
done
