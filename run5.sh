cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c5 out/charge-a5 dist-charge5
npx vite build --outDir dist-charge5 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge5 --arena c --pre 60 --post 90 --out out/charge-c5 > out/charge-c5.log 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge5 --arena a --pre 60 --post 90 --out out/charge-a5 > out/charge-a5.log 2>&1
