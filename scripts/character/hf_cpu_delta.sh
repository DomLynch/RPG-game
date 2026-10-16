#!/usr/bin/env bash
# HF cpu-upgrade job (image mcr.microsoft.com/playwright:v1.62.1-noble, software GL: a relative read): [zone ready] at 375, BASE vs HEAD, RUNS pairs, the order alternating
# (base first on odd runs, head first on even runs) so a drift in the box cannot favour one side. env: HEAD, BASE (shas), RUNS (default 6)
set -uo pipefail
: "${HEAD:?}" "${BASE:?}"
apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq git ffmpeg libjpeg-turbo-progs >/dev/null 2>&1
id pwuser >/dev/null 2>&1 || useradd -m pwuser
cat > /home/pwuser/run.sh <<'EOS'
set -uo pipefail
cd /home/pwuser && git clone -q --filter=blob:none https://github.com/DomLynch/RPG-game.git r && cd r
git checkout -q "$HEAD" && npm ci --no-audit --no-fund >/dev/null 2>&1; echo "NPMCI=$?"; nproc
cp scripts/remote-programs-check.mjs /home/pwuser/check.mjs
for pair in "base:$BASE" "head:$HEAD"; do
  label=${pair%%:*}; sha=${pair#*:}; git checkout -q "$sha" || exit 1
  rm -rf "/home/pwuser/dist-$label"; npx vite build --config origins/preview/vite.config.mjs --outDir "/home/pwuser/dist-$label" > "/home/pwuser/build-$label.log" 2>&1; echo "BUILD-$label=$? $(git rev-parse --short HEAD)"
done
git checkout -q "$HEAD"; cp /home/pwuser/check.mjs scripts/remote-programs-check.mjs
for i in $(seq 1 "${RUNS:-6}"); do
  if (( i % 2 )); then order="base head"; else order="head base"; fi
  for label in $order; do
    KITS=none GATE= node scripts/remote-programs-check.mjs "/home/pwuser/dist-$label" "/home/pwuser/out-$label-$i" 2>&1 | grep -E "^zoneReady:" | sed "s/^/$label#$i /" | cut -c1-260
  done
done
echo "=== DONE ==="
EOS
chown pwuser /home/pwuser/run.sh
su pwuser -c "HEAD=$HEAD BASE=$BASE RUNS=${RUNS:-6} bash /home/pwuser/run.sh"
