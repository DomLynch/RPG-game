#!/usr/bin/env bash
# Zone 1 boulder tint variants on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/boulder-tint-stills.sh
# Builds the page with the row as committed ("row"), with no tint ("none", the shipped olive) and two other tones, and takes the boulder pair close-up
# (scripts/boulder-close-stills.mjs, 8 m off the pair at -48, 44) at 375x812 and 844x390 into artifacts/boulder-tint/<variant>-<size>/boulders.png.
set -euo pipefail
ROW=origins/zone-rows/zone1.row.json
cp "$ROW" /tmp/zone1.row.orig
shoot() {   # $1 variant name
  npx vite build --config origins/preview/vite.config.mjs --outDir "/tmp/d-$1" > "/tmp/b-$1.log" 2>&1 || { tail -20 "/tmp/b-$1.log"; exit 1; }
  for v in 375x812 844x390; do VIEW=$v node scripts/boulder-close-stills.mjs "/tmp/d-$1" "artifacts/boulder-tint/$1-$v"; done
}
setcolor() {   # r g b roughness: the three boulder nodes' tint
  python3 - "$ROW" "$1" "$2" "$3" "$4" <<'PY'
import json, sys
p, r, g, b, rough = sys.argv[1], *map(float, sys.argv[2:6])
d = json.load(open(p))
for n in ("boulder_a", "boulder_b", "boulder_c"): d["kit"].setdefault("tint", {})[n] = {"color": [r, g, b], "roughness": rough}
json.dump(d, open(p, "w"), indent=2)
PY
}
want() { [[ $# -eq 0 || " ${ONLY:-} " == *" $1 "* || -z "${ONLY:-}" ]]; }   # ONLY="none row" limits the variants
if want row; then shoot row; fi
if want grey; then setcolor 0.8 0.78 1.1 1; shoot grey; fi
if want cool; then setcolor 1.1 1.0 1.9 1; shoot cool; fi
python3 - "$ROW" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); d["kit"].pop("tint", None); json.dump(d, open(sys.argv[1], "w"), indent=2)
PY
if want none; then shoot none; fi
cp /tmp/zone1.row.orig "$ROW"
