cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c8 out/charge-a8 dist-charge8
npx vite build --outDir dist-charge8 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge8 --arena c --pre 60 --post 90 --out out/charge-c8 > out/charge-c8.log 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/nyx-nightfall-clip.mjs --special centurion --dist dist-charge8 --arena a --pre 60 --post 90 --out out/charge-a8 > out/charge-a8.log 2>&1
