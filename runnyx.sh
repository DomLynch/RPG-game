#!/bin/bash
cd /opt/frankendom-shadow/work/world-extra
rm -rf out/nyx-c49 dist-nyx49
npx vite build --outDir dist-nyx49 >build49.log 2>&1 || exit 1
node scripts/nyx-nightfall-clip.mjs --dist dist-nyx49 --arena c --out out/nyx-c49 > clip49.log 2>&1
ffmpeg -y -framerate 60 -i out/nyx-c49/f%05d.jpg -vf scale=376:812,setsar=1 -c:v libx264 -pix_fmt yuv420p -crf 20 nyx-day-49ad5fd2.mp4 >ff49.log 2>&1
echo DONE >> clip49.log
