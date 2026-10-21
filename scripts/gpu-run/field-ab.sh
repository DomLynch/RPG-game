#!/usr/bin/env bash
# The Frontier field-dirt tint A/A and A/B on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/field-ab.sh [factor ...]   (default 0.8 0.6)
# "trunk" = origins/preview as on the trunk (before the `field` tint exists), "f1" = this head with NO field rows (must equal trunk: the A/A, ground L* within +-0.5), then each factor sets every look's
# `field` multiplier in zone1.row.json to [f, f, f]. Each is built and measured at 375x812 and 844x390 (scripts/readability-stills.mjs); a plain still (walk.jpg) is kept for the dome horizon blend.
set -euo pipefail
ROW=origins/zone-rows/zone1.row.json
cp "$ROW" /tmp/zone1.row.orig
FACTORS=("$@"); [[ ${#FACTORS[@]} -gt 0 ]] || FACTORS=(0.8 0.6)
mkdir -p artifacts/field-ab
measure() {   # $1 name
  npx vite build --config origins/preview/vite.config.mjs --outDir "/tmp/d-$1" > "/tmp/b-$1.log" 2>&1 || { tail -20 "/tmp/b-$1.log"; exit 1; }
  for v in 375x812 844x390; do echo "VARIANT $1 $v"; VIEW=$v node scripts/readability-stills.mjs "/tmp/d-$1" "artifacts/field-ab/$1-$v" || true; done
}
git fetch -q origin codex/01a09a76/task-1
cp -r origins/preview /tmp/preview.head
git checkout -q FETCH_HEAD -- origins/preview/main.ts origins/preview/look.ts origins/preview/frontier.ts
measure trunk
cp /tmp/preview.head/main.ts /tmp/preview.head/look.ts /tmp/preview.head/frontier.ts origins/preview/
measure f1
for f in "${FACTORS[@]}"; do
  cp /tmp/zone1.row.orig "$ROW"
  python3 - "$ROW" "$f" <<'PY'
import json, sys
p, k = sys.argv[1], float(sys.argv[2])
d = json.load(open(p))
for look in d.get("looks", {}).values(): look["field"] = [k, k, k]
json.dump(d, open(p, "w"), indent=2)
PY
  measure "f$f"
done
cp /tmp/zone1.row.orig "$ROW"
