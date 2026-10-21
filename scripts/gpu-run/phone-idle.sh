#!/usr/bin/env bash
# The idle-hitch hunt (Lead 2026-10-21: a 0.6 s stall while standing still at CPU x4): node scripts/gpu-run.mjs <sha> --timeout 20m -- bash scripts/gpu-run/phone-idle.sh
# LIVE Zone 1 on a phone profile, CPU x4, 90 s standing still after the settle; every long task with its start time (the period) and every long animation frame with who ran in it (the owner).
set -uo pipefail
OUT=artifacts/gpu-run-stills/phone-idle
mkdir -p "$OUT"
export REAL_GPU=1
node scripts/phone-perf-probe.mjs "$OUT" live --throttle 4 --orient portrait,landscape --idle 90000 --phases idle 2>&1 | grep -E 'PERF|rror' | cut -c1-700
ls -la "$OUT" | head
