#!/usr/bin/env bash
# One special in the Zone 1 walk on the LIVE page (read-only), on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/live-special-walk.sh <cleave|reaping|stomp|lunge> [label]
# presence=0 (the probe URL): the live presence warp would otherwise move the hero out of range of the creature the probe stands next to.
set -uo pipefail
export REAL_GPU=1 LIVE_URL="${LIVE_URL:-https://frankendom.com}"; mkdir -p /tmp/unused-dist
FRAMES=1 SKILL="$1" node scripts/zone1-world-special-probe.mjs /tmp/unused-dist "artifacts/gpu-run-stills/${2:-live}/walk-$1" 2>&1 | grep -E "clips played|page errors|SPECIAL press|label|target" | head -12
