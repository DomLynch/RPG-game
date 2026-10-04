cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c4 out/charge-a4 dist-charge4
npx vite build --outDir dist-charge4 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge4 --arena c --pre 60 --post 90 --out out/charge-c4 > out/charge-c4.log 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge4 --arena a --pre 60 --post 90 --out out/charge-a4 > out/charge-a4.log 2>&1
