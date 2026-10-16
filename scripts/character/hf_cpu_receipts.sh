#!/usr/bin/env bash
# HF cpu-upgrade job (image mcr.microsoft.com/playwright:v1.62.1-noble, software GL: a relative read, like the VPS): the kit warm-up tests, the seamless row,
# and [zone ready] at 375 for BASE vs HEAD x3 (alternating). Same steps as the VPS run-seamless.sh / run-delta.sh. env: HEAD (sha), BASE (sha)
set -uo pipefail
: "${HEAD:?}" "${BASE:?}"
apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq git ffmpeg libjpeg-turbo-progs >/dev/null 2>&1
id pwuser >/dev/null 2>&1 || useradd -m pwuser
cat > /home/pwuser/run.sh <<'EOS'
set -uo pipefail
cd /home/pwuser && git clone -q --filter=blob:none https://github.com/DomLynch/RPG-game.git r && cd r
git checkout -q "$HEAD" && echo "HEAD $(git rev-parse --short HEAD)"
npm ci --no-audit --no-fund >/dev/null 2>&1; echo "NPMCI=$?"; nproc
node --test tests/origins-world-combat.test.ts tests/origins-test-stubs.test.ts tests/origins-warm-kits.test.ts tests/origins-dress-remote.test.ts tests/preview-rules.test.ts 2>&1 | grep -E "^# (pass|fail)|^not ok"
npx vite build --config origins/preview/vite.config.mjs > /home/pwuser/build.log 2>&1; echo "BUILD=$?"
node scripts/origins-seamless-check.mjs 2>&1 | tail -25 | cut -c1-400; echo "SEAMLESS-EXIT=${PIPESTATUS[0]}"
cp scripts/remote-programs-check.mjs /home/pwuser/check.mjs
for pair in "base:$BASE" "head:$HEAD"; do
  label=${pair%%:*}; sha=${pair#*:}; git checkout -q "$sha" || exit 1
  rm -rf "/home/pwuser/dist-$label"; npx vite build --config origins/preview/vite.config.mjs --outDir "/home/pwuser/dist-$label" > "/home/pwuser/build-$label.log" 2>&1; echo "BUILD-$label=$? $(git rev-parse --short HEAD)"
done
git checkout -q "$HEAD"; cp /home/pwuser/check.mjs scripts/remote-programs-check.mjs
for i in 1 2 3; do for label in base head; do
  KITS=none GATE= node scripts/remote-programs-check.mjs "/home/pwuser/dist-$label" "/home/pwuser/out-$label-$i" 2>&1 | grep -E "^zoneReady:" | sed "s/^/$label#$i /" | cut -c1-260
done; done
echo "=== DONE ==="
EOS
chown pwuser /home/pwuser/run.sh
su pwuser -c "HEAD=$HEAD BASE=$BASE bash /home/pwuser/run.sh"
