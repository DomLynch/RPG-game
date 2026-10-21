#!/usr/bin/env bash
# VPS job: capture --prio 3 char bash /srv/dev-jobs/char-webp/seamless-phone-vps.sh
# seamless-quiet (newPrograms after [zone ready] must be []) under the PHONE tier, on the trunk tree (wt-before) and the loot-defer tree (wt-after), both built by ground-defer-vps.sh.
set -uo pipefail
for T in before after; do
  W=/srv/dev-jobs/char-webp/wt-$T
  cp /srv/dev-jobs/char-webp/seamless-phone-preload.mjs "$W/seamless-phone-preload.mjs"
  echo "=== $T $(git -C $W rev-parse --short HEAD)"
  (cd "$W" && SEAMLESS_QUIET=1 SEAMLESS_STRIKE=1 SEAMLESS_PROGRAMS=1 timeout 1500 node --import ./seamless-phone-preload.mjs scripts/origins-seamless-check.mjs 2>&1 | grep -vE "^\s+at " | tail -14)
  echo "exit $?"
  node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("RECEIPT", JSON.stringify({viewport:r.viewport,renderer:(r.renderer||"").slice(0,40),programsBeforeTap:r.programsBeforeTap,programsAfterEngage:r.programsAfterEngage,newPrograms:r.newPrograms,newProgramKeys:r.newProgramKeys,errors:r.errors}))' "$W/artifacts/origins-seamless.json"
done
