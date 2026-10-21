#!/usr/bin/env bash
# CPU profile of the Zone 1 page on a T4 (real GPU), the checked-out tree built UNMINIFIED: iPhone UA, 4x CPU: walk, fight, idle; then 1x walk.
# node scripts/gpu-run.mjs <sha with this script> --timeout 40m -- bash scripts/gpu-run/zone-profile-t4.sh
set -uo pipefail
mkdir -p artifacts/zone-profile
npx vite build --minify false --config origins/preview/vite.config.mjs > /tmp/b-live.log 2>&1 || { tail -20 /tmp/b-live.log; exit 1; }
for spec in "4 walk" "4 fight" "4 idle" "1 walk"; do
  set -- $spec
  echo "######## rate $1 phase $2"
  REAL_GPU=1 CPU_RATE=$1 PHASE=$2 DEVICE=iphone WINDOW_MS=30000 TOP=30 node scripts/zone-profile.mjs "$PWD" "live-$2" artifacts/zone-profile 2>&1 | grep -v "GL Driver"
done
echo ALLDONE
