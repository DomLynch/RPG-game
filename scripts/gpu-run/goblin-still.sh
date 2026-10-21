#!/usr/bin/env bash
# The Zone 1 level-1 goblin at the head (RV89: the world row, 45 hp), seen at 4 m and 2 m (the hero faces it), phone portrait:
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/goblin-still.sh [375x812 ...]
# Writes artifacts/goblin-still/<WxH>/<shot>.jpg.
set -euo pipefail
VIEWS=("$@"); if [[ ${#VIEWS[@]} -eq 0 ]]; then VIEWS=(375x812); fi
SHOTS='[{"name":"goblin-4m","mob":"scavengers-2","standoff":4},{"name":"goblin-2m","mob":"scavengers-2","standoff":2}]'
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-gob > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
mkdir -p artifacts/goblin-still
for v in "${VIEWS[@]}"; do
  VIEW=$v SHOTS="$SHOTS" SETTLE=7000 node scripts/creature-spot-stills.mjs /tmp/d-gob "artifacts/goblin-still/$v"
done
