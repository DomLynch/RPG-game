#!/usr/bin/env bash
# Zone 1 creature spots, the salamander seen from the fields road and the troll seen from the east road, a goblin camp still for the blade glint:
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/creature-spots.sh [844x390 375x812 ...]   (no args = both phone views)
#   env ONLY=after builds just this head; default also builds "before" (the trunk rows this branch started from, BASE below)
# Writes artifacts/creature-spots/{before,after}-<WxH>/<shot>.jpg. About 2.5 MB of images come back in the log, so two views is the most one job carries.
set -euo pipefail
BASE=8b53a5f29   # the trunk head the rows PR started from: the "before" rows
VIEWS=("$@"); if [[ ${#VIEWS[@]} -eq 0 ]]; then VIEWS=(844x390 375x812); fi
SHOTS='[{"name":"s1-road-gate","from":[-102,-25],"look":[-119.4,-9.9]},{"name":"s1-fields-road","from":[-102,-5],"look":[-119.4,-9.9]},{"name":"t2-east-road","from":[-110,-50],"look":[-124,-34]},{"name":"goblins-glint","from":[-102,18],"look":[-102,40]}]'
BUILDS=(after)
npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-after > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
if [[ "${ONLY:-}" != after ]]; then
  git fetch -q --depth 1 origin "$BASE" 2>/dev/null || true
  git checkout -q "$BASE" -- origins/zone-rows/zone1.row.json
  npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/d-before > /tmp/origins-build2.log 2>&1 || { tail -20 /tmp/origins-build2.log; exit 1; }
  BUILDS=(before after)
fi
mkdir -p artifacts/creature-spots
for b in "${BUILDS[@]}"; do for v in "${VIEWS[@]}"; do
  VIEW=$v SHOTS="$SHOTS" SETTLE=7000 node scripts/creature-spot-stills.mjs "/tmp/d-$b" "artifacts/creature-spots/$b-$v"
done; done
