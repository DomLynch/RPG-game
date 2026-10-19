#!/usr/bin/env bash
# Scratch (not for trunk): RV80 counter-thrust and counter-heavy gates on an HF CPU job, tree = 8da82ae4e plus this file.
set -uo pipefail
npm ci --no-audit --no-fund > /tmp/npm.log 2>&1 || { echo "GATE npm-ci FAILED"; tail -20 /tmp/npm.log; exit 1; }
npm run build > /tmp/build.log 2>&1 || { echo "GATE build FAILED"; tail -20 /tmp/build.log; exit 1; }
npx playwright install --with-deps chromium > /tmp/pw.log 2>&1 || { echo "GATE playwright FAILED"; tail -20 /tmp/pw.log; exit 1; }
for r in riposte heavy_riposte; do
  COUNTER_ONLY=$r node scripts/counter-browser-check.mjs > /tmp/c-$r.log 2>&1; echo "GATE counter-$r rc=$?"; tail -8 /tmp/c-$r.log
done
echo GATES-DONE
