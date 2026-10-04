cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c7 out/charge-a7 dist-charge7
npx vite build --outDir dist-charge7 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge7 --arena c --pre 60 --post 90 --out out/charge-c7 > out/charge-c7.log 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge7 --arena a --pre 60 --post 90 --out out/charge-a7 > out/charge-a7.log 2>&1
