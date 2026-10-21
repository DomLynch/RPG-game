#!/usr/bin/env bash
# VPS job: capture --prio 3 char bash /srv/dev-jobs/char-webp/loot-draw-vps.sh : programs at a loot item's first draw after ready, trunk (wt-before) vs the loot-defer head (wt-after); run after ground-defer-vps.sh has built both.
set -uo pipefail
for T in before after; do
  W=/srv/dev-jobs/char-webp/wt-$T
  cp /srv/dev-jobs/char-webp/loot-draw-programs.mjs "$W/loot-draw-programs.mjs"
  echo "=== $T $(git -C $W rev-parse --short HEAD)"
  (cd "$W" && timeout 1200 node loot-draw-programs.mjs $T 2>&1 | grep -vE "^\s+at " | tail -5)
done
