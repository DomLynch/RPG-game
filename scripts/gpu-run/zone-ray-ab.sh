#!/usr/bin/env bash
# One T4 job for the zone-creature surface-ray skip: BASE vs AFTER. (1) desktop viewport 1280x800, CPU x4, real GPU, 3 interleaved reps of the longest-task run;
# (2) zone fight stills at 375 phone UA (one run each, small jpegs); (3) Pit sparring stills at 375 (goblin, hero walks in and strikes), small jpegs.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 40m -- bash scripts/gpu-run/zone-ray-ab.sh <base sha> <after sha>
set -uo pipefail
BASE="${1:?base sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/zone-ray-ab
cp scripts/gpu-run/wound-longtask.mjs ./wound-longtask-run.mjs
cp scripts/gpu-run/pit-sig-frames.mjs ./pit-frames-run.mjs
for T in base after; do
  if [ $T = base ]; then REF=$BASE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build --minify false --config origins/preview/vite.config.mjs > "/tmp/bo-$T.log" 2>&1 && npx vite build > "/tmp/bm-$T.log" 2>&1) || { tail -20 "/tmp/bo-$T.log" "/tmp/bm-$T.log"; exit 1; }
done
echo "######## desktop x4 long tasks"
for REP in 1 2 3; do
  for T in base after; do
    DESKTOP=1 REAL_GPU=1 node ./wound-longtask-run.mjs "/tmp/wt-$T" "desktop-$T-r$REP" artifacts/zone-ray-ab 4 2>&1 | grep -E "^(RENDERER|LONGTASK)|rror"
  done
done
echo "######## zone 375 stills"
for T in base after; do
  STILLS=1 REAL_GPU=1 node ./wound-longtask-run.mjs "/tmp/wt-$T" "zone375-$T" artifacts/zone-ray-ab 1 2>&1 | grep -E "^(RENDERER|LONGTASK)|rror"
done
echo "######## pit 375 stills"
for T in base after; do
  FRAMES=24 STEP_MS=450 REAL_GPU=1 node ./pit-frames-run.mjs "/tmp/wt-$T/dist" artifacts/zone-ray-ab "pit375-$T" 2>&1 | grep -E "frames|rror"
done
du -sh artifacts/zone-ray-ab; ls artifacts/zone-ray-ab | wc -l
echo ALLDONE
