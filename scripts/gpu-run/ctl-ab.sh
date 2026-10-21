#!/usr/bin/env bash
# Control-arm job (Web 2026-10-21, Lead ruling): node scripts/gpu-run.mjs <live sha> --timeout 40m -- bash scripts/gpu-run/ctl-ab.sh
# ONE job, alternating rounds of three builds so every arm sees the same host: LIVE (this tree), CTL (4a0529c12: game code IDENTICAL to live, CI/deploy files only differ) and OLD (ed79766be, the K6q11 build).
# Same shape as dpr-ab/aa: unminified, iPhone UA portrait, CPU x4, --profile. The exit "holds in that job" only if CTL reads fight p95 <= 50 ms AND LIVE is not worse; a CTL that reads bad = a noisy host.
set -uo pipefail
OUT=artifacts/gpu-run-stills/ctl-ab
mkdir -p "$OUT"
export REAL_GPU=1
B="npx vite build --config origins/preview/vite.config.mjs --minify false"
$B --outDir ../dist-live > /tmp/b-live.log 2>&1 || { tail -20 /tmp/b-live.log; exit 1; }
for pair in ctl:4a0529c12 old:ed79766be; do
  name=${pair%%:*}; sha=${pair##*:}
  git fetch -q origin "$sha" 2>/dev/null || git fetch -q --unshallow 2>/dev/null || true
  git worktree add -q --detach "/tmp/wt-$name" "$sha" || { echo "cannot add worktree for $sha"; exit 1; }
  ln -s "$PWD/node_modules" "/tmp/wt-$name/node_modules"
  ( cd "/tmp/wt-$name" && $B --outDir ../dist-$name > /tmp/b-$name.log 2>&1 ) || { tail -20 "/tmp/b-$name.log"; exit 1; }
done
declare -A DIST=( [live]=origins/dist-live [ctl]=/tmp/wt-ctl/origins/dist-ctl [old]=/tmp/wt-old/origins/dist-old )
for r in 1 2 3 4 5; do
  for v in live ctl old; do
    node scripts/phone-perf-probe.mjs "$OUT/$v-$r" local --dist "${DIST[$v]}" --orient portrait --throttle 4 --idle 3000 --profile 2>&1 | grep -E 'PERF|rror' | cut -c1-260 | sed "s/^/$v-$r /"
  done
done
node -e '
const fs=require("fs");
const load=(v,r)=>{try{return JSON.parse(fs.readFileSync(`'$OUT'/${v}-${r}/local-portrait-x4.json`))}catch{return null}};
for (const ph of ["walk","fight"]) for (const v of ["live","ctl","old"]) {
  const rs=[1,2,3,4,5].map((r)=>load(v,r)), p95=rs.map((j)=>j?.phases?.[ph]?.frames?.p95Ms ?? null), med=rs.map((j)=>j?.phases?.[ph]?.frames?.medianMs ?? null);
  const ok=p95.filter((x)=>typeof x==="number" && x<=50.2).length;
  console.log(`CTL ${ph} ${v} p5fps=${JSON.stringify(p95.map((x)=>typeof x==="number"?+(1000/x).toFixed(1):null))} p95Ms=${JSON.stringify(p95)} medianMs=${JSON.stringify(med)} runsAtOrUnder50ms=${ok}/5`);
}
'
