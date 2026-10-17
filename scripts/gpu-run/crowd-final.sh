#!/usr/bin/env bash
# TEST ONLY (never merged): the final cheap-parts measurement in ONE T4 job. 1) dump every skinned mesh name, 2) build the hide list from it (Characters' names + every Antique_brass*), 3) same-job A/B at 40 walking, 4x, 4) before/after stills at 375.
set -euo pipefail
echo '{"remoteCheap":[{"id":"cheap","fields":{"hideParts":[]}}]}' > origins/preview/remote-cheap.json   # the row emptied: the HIDE override is the only thing hiding, so ctl really is "off"
node scripts/gpu-run/patch-hide.cjs
node scripts/gpu-run/patch-dump.cjs
node scripts/gpu-run/patch-crowdstills.cjs
npx vite build --config origins/preview/vite.config.mjs --minify false > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
NOGOV='{"remoteAdaptSlowMs":100000,"remoteFullCount":4,"remoteAdaptFullCount":4}'
run() { name="$1"; hide="$2"; counts="$3"; echo "=== VARIANT $name hide=$hide"; SERVE=1 PROFILE=1 COUNTS="$counts" MODES=walk THROTTLE=4 WINDOW=6000 RULES="$NOGOV" HIDE="$hide" OUT="artifacts/crowd-var/$name" node scripts/origins-crowd-fps.mjs || true; }
run ctl '[]' 40
HIDEFINAL=$(node -e '
const d = JSON.parse(require("fs").readFileSync("artifacts/crowd-var/ctl/receipt.json", "utf8")); const c = d.results.find((x) => x.n === 40);
const names = Object.keys(c.allMeshes || {});
console.error("ALL SKINNED MESH NAMES:", JSON.stringify(c.allMeshes));
const fixed = ["PhotoEyes", "PhotoTeeth", "Steel", "WrapBoots", "LeatherBody"], brass = names.filter((n) => /^Antique_brass/.test(n));
console.error("brass meshes found:", JSON.stringify(brass), " fixed present:", JSON.stringify(fixed.filter((n) => names.includes(n))), " fixed MISSING:", JSON.stringify(fixed.filter((n) => !names.includes(n))));
console.log(JSON.stringify([...fixed, ...brass]));')
echo "HIDEFINAL=$HIDEFINAL"
run fin "$HIDEFINAL" 40
run ctl2 '[]' 40
mkdir -p artifacts/crowd-hide
STILLRULES='{"remoteFullCount":4,"remoteAdaptFullCount":4,"remoteAdaptSlowMs":100000}'
SERVE=1 OUT=artifacts/crowd-hide/before N=40 RULES="$STILLRULES" HIDE='[]' node scripts/origins-crowd-page-check.mjs || true
SERVE=1 OUT=artifacts/crowd-hide/after N=40 RULES="$STILLRULES" HIDE="$HIDEFINAL" node scripts/origins-crowd-page-check.mjs || true
echo FINAL-DONE
