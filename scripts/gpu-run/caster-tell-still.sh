#!/usr/bin/env bash
# The caster-tell stills on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/caster-tell-still.sh <spell id> [label]
# Builds the game, then scripts/caster-tell-still.mjs shoots ready idle and the spell mid-cast at 375 wide (sparring against the dummy, ?spell look test) into artifacts/gpu-run-stills/<label>/.
# The still script passes --use-angle=swiftshader itself; the runner's Chromium wrapper strips it, so these draw on the T4.
set -euo pipefail
npx vite build > /tmp/game-build.log 2>&1 || { tail -20 /tmp/game-build.log; exit 1; }
node scripts/caster-tell-still.mjs --dist dist --spell "${1:?spell id}" --out "artifacts/gpu-run-stills/${2:-caster-tell}" --every 12
