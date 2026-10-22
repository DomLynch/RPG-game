#!/usr/bin/env bash
# The kit LOD swap vs arm C on the T4, in ONE job: frame-breakdown of a Zone 1 fight frame at ?crowd=0 with the swap off (?kitlod=0 = arm C, the radius rows only) and on (the default), then the framing-matched near/far stills.
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/kit-lod.sh
set -euo pipefail
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
for arm in "C-lod-off:&kitlod=0" "D-lod-on:"; do
  echo "== arm ${arm%%:*}"
  node scripts/frame-breakdown.mjs artifacts/origins-preview "artifacts/kit-lod/${arm%%:*}" --query "&crowd=0${arm#*:}" --topn 6 2>&1 | grep -E "^FRAME-BREAKDOWN|^  " | sed -E 's/renders=\[[^]]*\] //' | cut -c1-420
done
node scripts/kit-lod-stills.mjs artifacts/origins-preview artifacts/kit-lod/stills 2>&1 | tail -3 | cut -c1-400
