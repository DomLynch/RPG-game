#!/usr/bin/env bash
# Paired A/B for the walk-loop innerHeight cache (#3529, Web 2026-10-21): node scripts/gpu-run.mjs <sha> --timeout 40m -- bash scripts/gpu-run/labels-ab.sh
# base = trunk 29fb58b5d's origins/preview/main.ts, head = this tree's. Same job, same GPU, 5 alternating pairs, iPhone UA / DPR 3 portrait, CPU x4, walk + fight.
# Prints one PERF line per run (renderer string included) and a median summary: fight/walk frame ms (median, p95, p99), long tasks >50 ms, clamp-rate fields (frames, clamped, paused, clampedShare, gameSpeed).
set -uo pipefail
BASE=29fb58b5d
OUT=artifacts/gpu-run-stills/labels-ab
mkdir -p "$OUT"
export REAL_GPU=1
git fetch -q origin "$BASE" 2>/dev/null || git fetch -q --unshallow 2>/dev/null || true
npx vite build --config origins/preview/vite.config.mjs --outDir ../dist-head > /tmp/build-head.log 2>&1 || { tail -20 /tmp/build-head.log; exit 1; }
cp origins/preview/main.ts /tmp/main.head.ts
git show "$BASE:origins/preview/main.ts" > origins/preview/main.ts || { echo "cannot read $BASE"; exit 1; }
npx vite build --config origins/preview/vite.config.mjs --outDir ../dist-base > /tmp/build-base.log 2>&1 || { tail -20 /tmp/build-base.log; exit 1; }
cp /tmp/main.head.ts origins/preview/main.ts
for r in 1 2 3 4 5; do
  for v in base head; do
    node scripts/phone-perf-probe.mjs "$OUT/$v-$r" local --dist "origins/dist-$v" --orient portrait --throttle 4 --idle 3000 2>&1 | grep -E 'PERF|rror' | cut -c1-600 | sed "s/^/$v-$r /"
  done
done
node -e '
const fs=require("fs"), med=(a)=>{a=a.filter((x)=>typeof x==="number").sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null};
for (const ph of ["walk","fight"]) for (const v of ["base","head"]) {
  const rs=[1,2,3,4,5].map((r)=>{try{return JSON.parse(fs.readFileSync(`'$OUT'/${v}-${r}/local-portrait-x4.json`))}catch{return null}}).filter(Boolean);
  const f=(k)=>med(rs.map((j)=>j.phases[ph].frames[k])), c=(k)=>med(rs.map((j)=>j.clamp?.[ph]?.[k]));
  console.log(`SUMMARY ${ph} ${v} n=${rs.length} calib=${med(rs.map((j)=>j.calibMs))} fps=${f("fpsMedian")} medianMs=${f("medianMs")} p95=${f("p95Ms")} p99=${f("p99Ms")} longTasks>50=${med(rs.map((j)=>j.phases[ph].longTasks.over50))} clampedShare=${c("clampedShare")} gameSpeed=${c("gameSpeed")} paused=${c("paused")} gl=${rs[0]?.env?.gl?.slice(0,60)}`);
}'
