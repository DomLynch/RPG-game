#!/bin/bash
set -x
cd /opt/frankendom-shadow/work/world-z2fix
cp zone1-move-stills.mjs /tmp/zone1-move-stills.mjs
OUT=/opt/frankendom-shadow/work/world-z2fix-out; rm -rf $OUT; mkdir -p $OUT
for pair in before:combat/zone1-stab after:world/hero-clips; do
  tag=${pair%%:*}; br=${pair#*:}
  git -c safe.directory='*' fetch -q origin $br && git -c safe.directory='*' checkout -q --detach FETCH_HEAD && git log --oneline -1
  rm -rf /tmp/z1dist-$tag; npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/z1dist-$tag 2>&1 | tail -3
  ls /tmp/z1dist-$tag | head -2 || { echo BUILD-FAILED; exit 1; }
  cp /tmp/zone1-move-stills.mjs scripts/zone1-move-stills.mjs
  timeout 900 node scripts/zone1-move-stills.mjs /tmp/z1dist-$tag $OUT/$tag 2>&1 | tail -8
  rm scripts/zone1-move-stills.mjs
done
echo DONE > $OUT/DONE
