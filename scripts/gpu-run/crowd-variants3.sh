#!/usr/bin/env bash
# TEST ONLY (never merged), round 3: hide small parts on CHEAP figures. Same job, 40 walking at 4x, governor off, all cheap; PROFILE gives busy ms/frame (not vsync-quantized), a still per case.
set -euo pipefail
node scripts/gpu-run/patch-hide.cjs
npx vite build --config origins/preview/vite.config.mjs --minify false > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
NOGOV='{"remoteAdaptSlowMs":100000,"remoteFullCount":0,"remoteAdaptFullCount":0}'
A='["Heraldry","PhotoEyes","PhotoTeeth","Face","Steel","WeaponDrawn_1"]'
B='["Heraldry","PhotoEyes","PhotoTeeth","Face","Steel","WeaponDrawn_1","WrapBoots","LeatherBody","Antique_brassBody"]'
run() { name="$1"; hide="$2"; counts="$3"; echo "=== VARIANT $name hide=$hide"; SERVE=1 PROFILE=1 COUNTS="$counts" MODES=walk THROTTLE=4 WINDOW=6000 RULES="$NOGOV" HIDE="$hide" OUT="artifacts/crowd-var/$name" node scripts/origins-crowd-fps.mjs || true; }
run ctl '[]' 0,40
run hideA "$A" 40
run hideB "$B" 40
run ctl2 '[]' 40
echo VARIANTS3-DONE
