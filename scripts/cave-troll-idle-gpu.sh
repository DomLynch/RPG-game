#!/bin/bash
# The Cave Troll idle frame on the GPU job (node scripts/gpu-run.mjs <sha> -- bash scripts/cave-troll-idle-gpu.sh): build the Origins preview, shoot f00 only. Artifacts land in artifacts/troll-idle.
npx vite build --config origins/preview/vite.config.mjs > /tmp/pv.log 2>&1; echo "PREVIEW-BUILD=$?"
IDLE_ONLY=1 node scripts/cave-troll-world-frames.mjs artifacts/origins-preview artifacts/troll-idle
