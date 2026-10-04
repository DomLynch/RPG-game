cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c10 out/charge-a10 dist-charge10
npx vite build --outDir dist-charge10 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/charge-clip.mjs --special centurion --dist dist-charge10 --arena c --pre 60 --post 90 --out out/charge-c10 > out/charge-c10.log 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/charge-clip.mjs --special centurion --dist dist-charge10 --arena a --pre 60 --post 90 --out out/charge-a10 > out/charge-a10.log 2>&1
