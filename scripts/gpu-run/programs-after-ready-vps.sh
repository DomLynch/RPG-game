#!/usr/bin/env bash
# VPS job: capture --prio 3 char bash /srv/dev-jobs/char-webp/programs-after-ready-vps.sh : programs linked after [zone ready], trunk (wt-before) vs loot-defer (wt-after), phone tier, no fight.
set -uo pipefail
for T in before after; do
  W=/srv/dev-jobs/char-webp/wt-$T
  cp /srv/dev-jobs/char-webp/programs-after-ready.mjs "$W/programs-after-ready.mjs"
  (cd "$W" && timeout 900 node programs-after-ready.mjs $T 2>&1 | grep -vE "^\s+at " | tail -4)
done
