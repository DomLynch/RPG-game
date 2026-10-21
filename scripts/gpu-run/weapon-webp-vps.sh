#!/usr/bin/env bash
# VPS job (capture --prio 3 char bash /srv/dev-jobs/char-webp/weapon-webp-vps.sh <branch sha>): builds the branch, takes the before/after stills and the texture crops into /srv/dev-jobs/char-webp/out.
set -euo pipefail
SHA="${1:?branch sha}"
cd /srv/dev-jobs/char-webp
[ -d repo ] || git clone -q https://github.com/DomLynch/RPG-game repo
cd repo
git fetch -q origin char/weapon-webp codex/01a09a76/task-1
git checkout -q -f "$SHA"
[ -d node_modules ] || npm ci --no-audit --no-fund > ../npm.log 2>&1
npx vite build --config origins/preview/vite.config.mjs > ../build.log 2>&1 || { tail -20 ../build.log; exit 1; }
mkdir -p ../before/weapons/shapes ../before/weapons/ranged ../out
git show origin/codex/01a09a76/task-1:public/weapons/shapes/gladius-crafted.glb > ../before/weapons/shapes/gladius-crafted.glb
git show origin/codex/01a09a76/task-1:public/weapons/ranged/bow-v1.glb > ../before/weapons/ranged/bow-v1.glb
python3 scripts/glb-texture-crops.py ../before/weapons/shapes/gladius-crafted.glb public/weapons/shapes/gladius-crafted.glb ../out gladius
python3 scripts/glb-texture-crops.py ../before/weapons/ranged/bow-v1.glb public/weapons/ranged/bow-v1.glb ../out bow
node scripts/weapon-webp-stills.mjs . ../before ../out
ls -la ../out
