cd /opt/frankendom-shadow/work/world-extra && rm -rf out/charge-c10 out/charge-a10
ls dist-charge10/index.html >/dev/null 2>&1 || npx vite build --outDir dist-charge10 >/dev/null 2>&1
CAPTURE_WAIT_S=28800 /opt/frankendom-shadow/bin/capture world sh /opt/frankendom-shadow/work/world-extra/both.sh > out/charge-run11.log 2>&1
