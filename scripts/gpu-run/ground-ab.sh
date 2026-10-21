#!/usr/bin/env bash
# The ground-value A/B for the phone readability note on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/ground-ab.sh [factor ...]   (default 1 0.8 0.6)
# Every look's `ground` multiplier in origins/zone-rows/zone1.row.json is scaled by the factor (1 = as shipped: [0.50, 0.47, 0.45]; 0.8 = [0.40, 0.376, 0.36]), the page is built and measured at 375x812 and 844x390
# (scripts/readability-stills.mjs: hero / creature / loot / props against the ground round them) and a plain walking still is kept for the horizon blend with the sky dome.
set -euo pipefail
ROW=origins/zone-rows/zone1.row.json
cp "$ROW" /tmp/zone1.row.orig
FACTORS=("$@"); [[ ${#FACTORS[@]} -gt 0 ]] || FACTORS=(1 0.8 0.6)
mkdir -p artifacts/ground-ab
for f in "${FACTORS[@]}"; do
  cp /tmp/zone1.row.orig "$ROW"
  python3 - "$ROW" "$f" <<'PY'
import json, sys
p, k = sys.argv[1], float(sys.argv[2])
d = json.load(open(p))
for name, look in d.get("looks", {}).items():
    if "ground" in look: look["ground"] = [round(c * k, 4) for c in look["ground"]]
json.dump(d, open(p, "w"), indent=2)
PY
  npx vite build --config origins/preview/vite.config.mjs --outDir "/tmp/d-$f" > "/tmp/b-$f.log" 2>&1 || { tail -20 "/tmp/b-$f.log"; exit 1; }
  for v in 375x812 844x390; do
    echo "FACTOR $f $v"
    VIEW=$v node scripts/readability-stills.mjs "/tmp/d-$f" "artifacts/ground-ab/f$f-$v" || true
  done
done
cp /tmp/zone1.row.orig "$ROW"
