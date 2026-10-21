#!/usr/bin/env bash
# #3525 z-fight check on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/road-zfight.sh
# Builds the page with the road and rut tops as committed ("after": 0.05 / 0.056) and with the old ones ("before": 0.075 / 0.085), and runs scripts/far-road-stills.mjs on each at 375x812 and 844x390 into
# artifacts/road-zfight/<variant>-<size>/{far.png,far.json}. STAND is the open spot east of the gate.
set -euo pipefail
RULES=origins/preview/preview-rules-defs.json
cp "$RULES" /tmp/rules.orig
shoot() {   # $1 variant
  npx vite build --config origins/preview/vite.config.mjs --outDir "/tmp/d-$1" > "/tmp/b-$1.log" 2>&1 || { tail -20 "/tmp/b-$1.log"; exit 1; }
  for v in 375x812 844x390; do STAND=-97.05,3.7 VIEW=$v node scripts/far-road-stills.mjs "/tmp/d-$1" "artifacts/road-zfight/$1-$v" || true; done
}
shoot after
sed -i -e 's/"id": "decalTopRoad", "value": 0.05,/"id": "decalTopRoad", "value": 0.075,/' -e 's/"id": "decalTopRut", "value": 0.056,/"id": "decalTopRut", "value": 0.085,/' "$RULES"
grep -c '"value": 0.075' "$RULES" >/dev/null
shoot before
cp /tmp/rules.orig "$RULES"
