#!/usr/bin/env bash
# The world melee-special windup stills on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/world-windup-still.sh [skill] [label]
# Builds the origins preview, then scripts/zone1-world-special-probe.mjs (REAL_GPU=1: no software-GL flags, so page time is real time) taps SPECIAL 1 in /preview/origins/?region=1&worldfight at 375 wide
# and shoots the windup (the boss-telegraph ring under the hero, row fx.bossTelegraph.worldColor) into artifacts/gpu-run-stills/<label>/.
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
REAL_GPU=1 FRAMES=1 SKILL="${1:-cleave}" node scripts/zone1-world-special-probe.mjs artifacts/origins-preview "artifacts/gpu-run-stills/${2:-world-windup}"
