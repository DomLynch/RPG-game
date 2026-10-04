cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c6 dist-charge6
npx vite build --outDir dist-charge6 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge6 --arena c --pre 60 --post 90 --out out/charge-c6 > out/charge-c6.log 2>&1
