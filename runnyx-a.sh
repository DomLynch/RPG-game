#!/bin/bash
cd /opt/frankendom-shadow/work/world-extra
rm -rf out/nyx-a49
node scripts/nyx-nightfall-clip.mjs --dist dist-nyx49 --arena a --out out/nyx-a49 > clipa49.log 2>&1
ffmpeg -y -framerate 60 -i out/nyx-a49/f%05d.jpg -vf scale=376:812,setsar=1 -c:v libx264 -pix_fmt yuv420p -crf 20 nyx-night-49ad5fd2.mp4 >ffa49.log 2>&1
echo DONE >> clipa49.log
