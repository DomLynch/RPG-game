#!/usr/bin/env bash
# Scratch (not for trunk): RV80 375x812 stills on an HF CPU job. Builds the head, takes live (before) and head (after) stills for the career fight and /zone/1/, prints each image as base64 between STILL markers.
set -uo pipefail
npm ci --no-audit --no-fund > /tmp/npm.log 2>&1 || { echo "STILLS npm-ci FAILED"; tail -20 /tmp/npm.log; exit 1; }
npx vite build > /tmp/build.log 2>&1 || { echo "STILLS build FAILED"; tail -20 /tmp/build.log; exit 1; }
npx vite build --config origins/preview/vite.config.mjs > /tmp/build-origins.log 2>&1 || { echo "STILLS origins build FAILED"; tail -20 /tmp/build-origins.log; exit 1; }
npx playwright install --with-deps chromium > /tmp/pw.log 2>&1 || { echo "STILLS playwright FAILED"; tail -20 /tmp/pw.log; exit 1; }
O=/tmp/stills; mkdir -p $O
node scripts/rv80-stills/default-on-stills.mjs --dist dist --out $O --tag after > $O/after.log 2>&1; echo "STILLS fight-after rc=$?"; tail -3 $O/after.log
node scripts/rv80-stills/default-on-stills.mjs --url https://frankendom.com/ --out $O --tag before > $O/before.log 2>&1; echo "STILLS fight-before rc=$?"; tail -3 $O/before.log
node scripts/rv80-stills/zone1-still.mjs $O zone1-after > $O/z1a.log 2>&1; echo "STILLS zone1-after rc=$?"; tail -3 $O/z1a.log
LIVE_URL='https://frankendom.com/preview/origins/?region=1' node scripts/rv80-stills/zone1-still.mjs $O zone1-before > $O/z1b.log 2>&1; echo "STILLS zone1-before rc=$?"; tail -3 $O/z1b.log
for f in $O/*.jpg $O/*.json; do echo "STILL-BEGIN $(basename $f)"; base64 -w0 "$f"; echo; echo "STILL-END $(basename $f)"; done
echo STILLS-DONE
