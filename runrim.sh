#!/bin/bash
cd /opt/frankendom-shadow/work/world-extra
rm -rf dist-rim out/nyx-a-rim out/price-a-off out/price-a-rim
npx vite build --outDir dist-rim >buildrim.log 2>&1 || { echo BUILDFAIL >> rim.log; exit 1; }
EXTRA='&look=nightrim' node scripts/nyx-nightfall-clip.mjs --dist dist-rim --arena a --out out/nyx-a-rim > cliprim1.log 2>&1
node scripts/special-clip.mjs --dist dist-rim --special price --arena a --out out/price-a-off --dpr 1 > clipprice0.log 2>&1
EXTRA='&look=nightrim' node scripts/special-clip.mjs --dist dist-rim --special price --arena a --out out/price-a-rim --dpr 1 > clipprice1.log 2>&1
echo DONE >> rim.log
