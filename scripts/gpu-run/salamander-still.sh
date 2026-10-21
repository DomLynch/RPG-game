#!/usr/bin/env bash
# The Zone 1 giant salamander at the head, seen at 4 m and 2 m (the hero faces it), phone portrait:
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/salamander-still.sh [375x812 ...]
# Writes artifacts/salamander-still/<WxH>/<shot>.jpg.
set -euo pipefail
VIEWS=("$@"); if [[ ${#VIEWS[@]} -eq 0 ]]; then VIEWS=(375x812); fi
SHOTS='[{"name":"sal-4m","mob":"salamander-pool-spot-1","standoff":4},{"name":"sal-2m","mob":"salamander-pool-spot-1","standoff":2}]'
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-sal > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
mkdir -p artifacts/salamander-still
for v in "${VIEWS[@]}"; do
  VIEW=$v SHOTS="$SHOTS" SETTLE=7000 node scripts/creature-spot-stills.mjs /tmp/d-sal "artifacts/salamander-still/$v"
done
