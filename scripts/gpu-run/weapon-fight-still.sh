#!/usr/bin/env bash
# The GPU proof stills of a picked-up weapon MID-EXCHANGE in the world fight: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/weapon-fight-still.sh [knife,longsword]
# Builds the origins preview and takes, per weapon, a 375-wide still of Zone 1 with his cut active against a creature, plus a 2x crop of the hero, into artifacts/gpu-run-stills/.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
WEAPONS="${1:-knife,longsword}" node scripts/zone1-weapon-fight-stills.mjs artifacts/origins-preview artifacts/gpu-run-stills
