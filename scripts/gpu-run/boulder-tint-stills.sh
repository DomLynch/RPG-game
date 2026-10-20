#!/usr/bin/env bash
# Zone 1 boulder tint variants on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/boulder-tint-stills.sh
# Builds the page with the row as committed ("row"), with no tint ("none", the shipped olive) and two other tones, and takes the camp view (wolf-in-view, 375 wide)
# of each into artifacts/boulder-tint/<variant>/. The three boulder nodes share one colour per variant.
set -euo pipefail
ROW=origins/zone-rows/zone1.row.json
cp "$ROW" /tmp/zone1.row.orig
shoot() {   # $1 variant name
  npx vite build --config origins/preview/vite.config.mjs --outDir "/tmp/d-$1" > "/tmp/b-$1.log" 2>&1 || { tail -20 "/tmp/b-$1.log"; exit 1; }
  node scripts/zone1-pack-stills.mjs "/tmp/d-$1" "artifacts/boulder-tint/$1" 1
  rm -f "artifacts/boulder-tint/$1/idle.png" "artifacts/boulder-tint/$1/fight.png"
}
shoot row
for v in "grey 0.8 0.78 1.1 1" "cool 1.1 1.0 1.9 1"; do
  set -- $v
  python3 - "$ROW" "$2" "$3" "$4" "$5" <<'PY'
import json, sys
p, r, g, b, rough = sys.argv[1], *map(float, sys.argv[2:6])
d = json.load(open(p))
for n in ("boulder_a", "boulder_b", "boulder_c"): d["kit"]["tint"][n] = {"color": [r, g, b], "roughness": rough}
json.dump(d, open(p, "w"), indent=2)
PY
  shoot "$1"
done
python3 - "$ROW" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); d["kit"].pop("tint", None); json.dump(d, open(sys.argv[1], "w"), indent=2)
PY
shoot none
cp /tmp/zone1.row.orig "$ROW"
