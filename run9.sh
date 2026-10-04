cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c9 out/charge-a9 dist-charge9
npx vite build --outDir dist-charge9 >/dev/null 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/charge-clip.mjs --special centurion --dist dist-charge9 --arena c --pre 60 --post 90 --out out/charge-c9 > out/charge-c9.log 2>&1
/opt/frankendom-shadow/bin/capture world node scripts/charge-clip.mjs --special centurion --dist dist-charge9 --arena a --pre 60 --post 90 --out out/charge-a9 > out/charge-a9.log 2>&1
