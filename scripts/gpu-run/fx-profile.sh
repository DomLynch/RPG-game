#!/usr/bin/env bash
# Fight-fx cost read (Web 2026-10-21): node scripts/gpu-run.mjs <sha> --timeout 30m -- bash scripts/gpu-run/fx-profile.sh
# One UNMINIFIED build (named functions), iPhone UA / DPR 3 portrait, CPU x4, 3 runs of the probe with --profile; prints, for the fight phase, the
# inclusive/self ms of everything in fight/fx.ts (onContact and its callees) next to the whole-phase busy ms, so fx.onContact's share of the fight is a number.
set -uo pipefail
OUT=artifacts/gpu-run-stills/fx-profile
mkdir -p "$OUT"
export REAL_GPU=1
npx vite build --config origins/preview/vite.config.mjs --minify false --outDir ../dist-unmin > /tmp/build-unmin.log 2>&1 || { tail -20 /tmp/build-unmin.log; exit 1; }
for r in 1 2 3; do
  node scripts/phone-perf-probe.mjs "$OUT/r$r" local --dist origins/dist-unmin --orient portrait --throttle 4 --idle 3000 --profile 2>&1 | grep -E 'PERF|rror' | cut -c1-300 | sed "s/^/r$r /"
done
node -e '
const fs=require("fs");
for (const r of [1,2,3]) {
  let j; try { j=JSON.parse(fs.readFileSync(`'$OUT'/r${r}/local-portrait-x4.json`)); } catch (e) { console.log(`FX r${r} no json`); continue; }
  const p=j.profile?.fight, w=j.profile?.walk;
  if (!p) { console.log(`FX r${r} no fight profile; keys=${Object.keys(j.profile||{})}`); continue; }
  console.log(`FX r${r} fight busyMs=${p.busyMs} totalMs=${p.totalMs} walk busyMs=${w?.busyMs} fight frames=${j.phases.fight.frames.n} medianMs=${j.phases.fight.frames.medianMs}`);
  const pick=(l)=>l.filter(([k])=>/fx\.ts|zoneFx|onContact|bodyWound|splat|blade|flinch|burst|getObjectByName|spark|dust|kick/i.test(k));
  console.log(`FX r${r} INCL`, JSON.stringify(pick(p.topInclusive).slice(0,30)));
  console.log(`FX r${r} SELF`, JSON.stringify(pick(p.topSelf).slice(0,20)));
  console.log(`FX r${r} TOPSELF`, JSON.stringify(p.topSelf.slice(0,12)));
  console.log(`FX r${r} BYFILE`, JSON.stringify(p.byFile.slice(0,8)));
}'
