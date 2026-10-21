#!/usr/bin/env bash
# ONE t4-small job on the live build (Web 2026-10-21, Lead's ask): node scripts/gpu-run.mjs <sha> --timeout 40m -- bash scripts/gpu-run/umw-fx.sh
#  (1) onContact receipt   : 5 alternating pairs, plain unminified build (shadow map 1024 on a phone) vs the same build with the phone map at 512, --profile on both:
#                            fight fx.onContact inclusive ms, fight p5 fps (1000 / p95 frame ms), native "(program)" share (GPU wait), whole-phase ms
#  (2) updateMatrixWorld   : 2 runs of a measurement build (origins/preview/umw-count.ts imported at the top of main.ts) that counts visits per scene-level branch
# No repo flag exists for the map size (main.ts sun.shadow.mapSize literal), so the 512 arm patches that literal in a throwaway build; nothing here is merged.
set -uo pipefail
OUT=artifacts/gpu-run-stills/umw-fx
mkdir -p "$OUT"
export REAL_GPU=1
B="npx vite build --config origins/preview/vite.config.mjs --minify false"
$B --outDir ../dist-plain > /tmp/b-plain.log 2>&1 || { tail -20 /tmp/b-plain.log; exit 1; }
cp origins/preview/main.ts /tmp/main.orig.ts
node -e '
const fs=require("fs"), f="origins/preview/main.ts", s=fs.readFileSync(f,"utf8"), a="sun.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048)";
if(!s.includes(a)){console.error("shadow literal not found");process.exit(3)}
fs.writeFileSync(f,s.replace(a,"sun.shadow.mapSize.set(PHONE ? 512 : 2048, PHONE ? 512 : 2048)"));' || exit 1
$B --outDir ../dist-sm512 > /tmp/b-512.log 2>&1 || { tail -20 /tmp/b-512.log; exit 1; }
cp /tmp/main.orig.ts origins/preview/main.ts
node -e '
const fs=require("fs"), f="origins/preview/main.ts", s=fs.readFileSync(f,"utf8");
fs.writeFileSync(f,"import \x27./umw-count.ts\x27;\n"+s);' || exit 1
$B --outDir ../dist-umw > /tmp/b-umw.log 2>&1 || { tail -20 /tmp/b-umw.log; exit 1; }
cp /tmp/main.orig.ts origins/preview/main.ts
for r in 1 2 3 4 5; do
  for v in plain sm512; do
    node scripts/phone-perf-probe.mjs "$OUT/$v-$r" local --dist "origins/dist-$v" --orient portrait --throttle 4 --idle 3000 --profile 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/$v-$r /"
  done
done
for r in 1 2; do
  node scripts/phone-perf-probe.mjs "$OUT/umw-$r" local --dist origins/dist-umw --orient portrait --throttle 4 --idle 3000 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/umw-$r /"
done
node -e '
const fs=require("fs"), med=(a)=>{a=a.filter((x)=>typeof x==="number").sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null};
const load=(v,r)=>{try{return JSON.parse(fs.readFileSync(`'$OUT'/${v}-${r}/local-portrait-x4.json`))}catch{return null}};
const incl=(p,pre)=>(p?.topInclusive.find(([k])=>k.startsWith(pre))||[0,0])[1], selfOf=(p,pre)=>(p?.topSelf.find(([k])=>k.startsWith(pre))||[0,0])[1];
for (const v of ["plain","sm512"]) {
  const rs=[1,2,3,4,5].map((r)=>load(v,r)).filter(Boolean);
  for (const ph of ["walk","fight"]) {
    const f=(k)=>med(rs.map((j)=>j.phases[ph].frames[k])), p=rs.map((j)=>j.profile?.[ph]);
    const p5=med(rs.map((j)=>j.phases[ph].frames.p95Ms ? +(1000/j.phases[ph].frames.p95Ms).toFixed(1) : null));
    console.log(`AB ${v} ${ph} n=${rs.length} medianMs=${f("medianMs")} p95Ms=${f("p95Ms")} p5fps=${p5} fps=${f("fpsMedian")} program(ms)=${med(p.map((x)=>selfOf(x,"(program)")))} phaseMs=${med(p.map((x)=>x?.totalMs))} programShare=${(()=>{const a=med(p.map((x)=>selfOf(x,"(program)"))),b=med(p.map((x)=>x?.totalMs));return a&&b?+(a/b).toFixed(3):null})()} onContact=${med(p.map((x)=>incl(x,"onContact")))} updateMatrixWorldSelf=${med(p.map((x)=>selfOf(x,"updateMatrixWorld")))} shadowRender=${med(p.map((x)=>incl(x,"WebGLShadowMap.render")))}`);
  }
  console.log(`AB ${v} per-run fight onContact`, JSON.stringify(rs.map((j)=>incl(j.profile?.fight,"onContact"))), "p95Ms", JSON.stringify(rs.map((j)=>j.phases.fight.frames.p95Ms)));
}
for (const r of [1,2]) { const j=load("umw",r); if(!j){console.log(`UMW r${r} no json`);continue;} for (const ph of ["walk","fight"]) console.log(`UMW r${r} ${ph}`, JSON.stringify(j.umw?.[ph])); }
'
