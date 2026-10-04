#!/bin/bash
cd /opt/frankendom-shadow/work/world-extra
rm -rf artifacts/presentation/clay-*
run(){ node scripts/impact-preview.mjs --label $1 --opponent nightborn --moments heavy --viewport 375x812 --full --frames 6,12,20 > $1.log 2>&1; }
run clay-after
cp src/scene.ts after-scene.ts; cp src/foot-dust.ts after-foot-dust.ts
cp before-src/scene.ts src/scene.ts; cp before-src/foot-dust.ts src/foot-dust.ts
run clay-before
cp after-scene.ts src/scene.ts; cp after-foot-dust.ts src/foot-dust.ts
echo DONE > clay.log
