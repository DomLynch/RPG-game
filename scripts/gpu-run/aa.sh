#!/usr/bin/env bash
# A/A on the live build (Web 2026-10-21, Lead ruling): node scripts/gpu-run.mjs <sha> --timeout 30m -- bash scripts/gpu-run/aa.sh
# Default arm only, the same job shape as dpr-ab.sh (one unminified build, iPhone UA portrait, CPU x4, --profile), 5 runs. The phone exit counts as met only if
# BOTH of two such jobs show fight p95 <= 50 ms in at least 4 of 5 runs. Prints per-run fight/walk p95 and the count.
set -uo pipefail
OUT=artifacts/gpu-run-stills/aa
mkdir -p "$OUT"
export REAL_GPU=1
npx vite build --config origins/preview/vite.config.mjs --minify false --outDir ../dist-plain > /tmp/b-plain.log 2>&1 || { tail -20 /tmp/b-plain.log; exit 1; }
for r in 1 2 3 4 5; do
  node scripts/phone-perf-probe.mjs "$OUT/r$r" local --dist origins/dist-plain --orient portrait --throttle 4 --idle 3000 --profile 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/r$r /"
done
node -e '
const fs=require("fs");
const runs=[1,2,3,4,5].map((r)=>{try{return JSON.parse(fs.readFileSync(`'$OUT'/r${r}/local-portrait-x4.json`))}catch{return null}});
for (const ph of ["walk","fight"]) {
  const p95=runs.map((j)=>j?.phases?.[ph]?.frames?.p95Ms ?? null), med=runs.map((j)=>j?.phases?.[ph]?.frames?.medianMs ?? null);
  const ok=p95.filter((x)=>typeof x==="number" && x<=50.2).length;
  console.log(`AA ${ph} p5fps=${JSON.stringify(p95.map((x)=>typeof x==="number"?+(1000/x).toFixed(1):null))} p95Ms=${JSON.stringify(p95)} medianMs=${JSON.stringify(med)} runsAtOrUnder50ms=${ok}/5 (50.2 tolerance for frame-timer rounding)`);
}
console.log("AA gl", runs.find(Boolean)?.env?.gl ?? "n/a", "calib", JSON.stringify(runs.map((j)=>j?.calibMs ?? null)));
'
