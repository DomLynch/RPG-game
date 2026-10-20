#!/usr/bin/env bash
# The Pit duel opened from Zone 1 on the LIVE page (read-only), on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/live-duel.sh [weapon] [label]
# weapon (default the longsword): bow = the hero wields the bow (originsPreview.forceWeapon), the buttons must read the bow's four names (Power Shot / Fan Volley / Pinning Shot / Quick Shot).
set -uo pipefail
export REAL_GPU=1 LIVE_URL="${LIVE_URL:-https://frankendom.com}"; mkdir -p /tmp/unused-dist
if [ -n "${1:-}" ] && [ "$1" != "sword" ]; then export WEAPON="$1"; fi
node scripts/zone1-pit-duel-clip-probe.mjs /tmp/unused-dist "artifacts/gpu-run-stills/${2:-live}/duel-${1:-sword}" 2>&1 | cut -c1-900 | tail -8
