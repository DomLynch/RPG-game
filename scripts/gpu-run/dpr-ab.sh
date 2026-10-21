#!/usr/bin/env bash
# ONE t4-small job on a live tree (Web 2026-10-21, Lead GO): node scripts/gpu-run.mjs <sha> --timeout 40m -- bash scripts/gpu-run/dpr-ab.sh
#  (1) render-resolution A/B at phone tier: the page's own ?dpr= override (src/fight/quality.ts urlDpr; phone default cap 1.25) vs ?dpr=1, one unminified build, 5 alternating pairs, --profile on every run
#      -> fight p5 fps (1000 / p95 frame ms), p95, median, walk the same, native "(program)" share, render and setProgram inclusive ms
#  (2) setProgram split by callee (the same profiles): self, getProgram/acquireProgram, uniform/light uploads, refresh* , compile
#  (3) lights in the fight scene + programs + pixel ratio/size actually used (the counter build, one run)
#  (4) 375-wide fight stills at both ratios side by side
# Nothing here is merged; the ratio stays a row if a lower one wins.
set -uo pipefail
OUT=artifacts/gpu-run-stills/dpr-ab
mkdir -p "$OUT"
export REAL_GPU=1
B="npx vite build --config origins/preview/vite.config.mjs --minify false"
$B --outDir ../dist-plain > /tmp/b-plain.log 2>&1 || { tail -20 /tmp/b-plain.log; exit 1; }
cp origins/preview/main.ts /tmp/main.orig.ts
node -e '
const fs=require("fs"), f="origins/preview/main.ts", s=fs.readFileSync(f,"utf8");
fs.writeFileSync(f,"import \x27./umw-count.ts\x27;\n"+s);' || exit 1
$B --outDir ../dist-umw > /tmp/b-umw.log 2>&1 || { tail -20 /tmp/b-umw.log; exit 1; }
cp /tmp/main.orig.ts origins/preview/main.ts
for r in 1 2 3 4 5; do
  node scripts/phone-perf-probe.mjs "$OUT/default-$r" local --dist origins/dist-plain --orient portrait --throttle 4 --idle 3000 --profile 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/default-$r /"
  node scripts/phone-perf-probe.mjs "$OUT/dpr1-$r" local --dist origins/dist-plain --orient portrait --throttle 4 --idle 3000 --profile --query dpr=1 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/dpr1-$r /"
done
node scripts/phone-perf-probe.mjs "$OUT/umw-1" local --dist origins/dist-umw --orient portrait --throttle 4 --idle 3000 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/umw-1 /"
node scripts/gpu-run/dpr-stills.mjs origins/dist-plain "$OUT/stills" 2>&1 | tail -3 | cut -c1-400
node -e '
const fs=require("fs"), med=(a)=>{a=a.filter((x)=>typeof x==="number").sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null};
const load=(v,r)=>{try{return JSON.parse(fs.readFileSync(`'$OUT'/${v}-${r}/local-portrait-x4.json`))}catch{return null}};
const incl=(p,pre)=>(p?.topInclusive.find(([k])=>k.startsWith(pre))||[0,0])[1], selfOf=(p,pre)=>(p?.topSelf.find(([k])=>k.startsWith(pre))||[0,0])[1];
for (const v of ["default","dpr1"]) {
  const rs=[1,2,3,4,5].map((r)=>load(v,r)).filter(Boolean);
  for (const ph of ["walk","fight"]) {
    const f=(k)=>med(rs.map((j)=>j.phases[ph].frames[k])), p=rs.map((j)=>j.profile?.[ph]);
    const p5=(j)=>j.phases[ph].frames.p95Ms ? +(1000/j.phases[ph].frames.p95Ms).toFixed(1) : null;
    const prog=med(p.map((x)=>selfOf(x,"(program)"))), tot=med(p.map((x)=>x?.totalMs));
    console.log(`AB ${v} ${ph} n=${rs.length} medianMs=${f("medianMs")} p95Ms=${f("p95Ms")} p5fps=${med(rs.map(p5))} fps=${f("fpsMedian")} perRunP95=${JSON.stringify(rs.map((j)=>j.phases[ph].frames.p95Ms))} programShare=${prog&&tot?+(prog/tot).toFixed(3):null} render=${med(p.map((x)=>incl(x,"WebGLRenderer.render")))} setProgramIncl=${med(p.map((x)=>incl(x,"setProgram")))} setProgramSelf=${med(p.map((x)=>selfOf(x,"setProgram")))} phaseMs=${tot}`);
  }
}
// setProgram callees (function-level inclusive/self ms, fight, median over the 10 runs): the names three.js uses between a program switch and the draw
const all=[1,2,3,4,5].flatMap((r)=>["default","dpr1"].map((v)=>load(v,r))).filter(Boolean).map((j)=>j.profile?.fight).filter(Boolean);
const names=new Set(); for (const p of all) for (const [k] of p.topInclusive) { const n=k.split(" ")[0]; if (/^(setProgram|getProgram|acquireProgram|getParameters|getProgramCacheKey|refreshUniformsCommon|refreshMaterialUniforms|refreshFogUniforms|upload|setValue\w*|uniform\w*|WebGLUniforms|WebGLProgram|initMaterial|setupLights|setup|setupLightsView|setupView|markUniformsLightsNeedsUpdate|useProgram|compile\w*|links|checkShaderErrors|updateMultiplexData)$/.test(n)) names.add(n); }
const rows=[]; for (const n of names) { const inc=med(all.map((p)=>(p.topInclusive.filter(([k])=>k.split(" ")[0]===n).reduce((a,[,v])=>Math.max(a,v),0)))); const sf=med(all.map((p)=>(p.topSelf.filter(([k])=>k.split(" ")[0]===n).reduce((a,[,v])=>a+v,0)))); rows.push([n,inc,sf]); }
rows.sort((a,b)=>b[1]-a[1]); console.log("SETPROGRAM callees [name, inclusiveMs(max entry), selfMs(sum)] ", JSON.stringify(rows.slice(0,30)));
const u=load("umw",1); if (u) for (const ph of ["walk","fight"]) console.log(`LIGHTS ${ph}`, JSON.stringify(u.lights?.[ph]));
'
