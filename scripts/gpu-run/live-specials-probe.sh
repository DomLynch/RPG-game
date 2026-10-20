#!/usr/bin/env bash
# Read-only live probe of the four specials in Zone 1 and the Pit duel opened from Zone 1, on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/live-specials-probe.sh [label]
# LIVE_URL (default https://frankendom.com): the deployed pages, no build. Per special: scripts/zone1-world-special-probe.mjs (SKILL=cleave|reaping|stomp|lunge) prints the clips played; then the duel probe.
set -uo pipefail
export REAL_GPU=1 LIVE_URL="${LIVE_URL:-https://frankendom.com}"; L="${1:-live}"
mkdir -p /tmp/unused-dist
for k in cleave reaping stomp lunge; do
  echo "== zone1 walk $k"; FRAMES=1 SKILL=$k node scripts/zone1-world-special-probe.mjs /tmp/unused-dist "artifacts/gpu-run-stills/$L/walk-$k" 2>&1 | grep -E "clips played|page errors|SPECIAL press" | head -6
done
echo "== duel opened from Zone 1"; node scripts/zone1-pit-duel-clip-probe.mjs /tmp/unused-dist "artifacts/gpu-run-stills/$L/duel" 2>&1 | cut -c1-700 | tail -6
