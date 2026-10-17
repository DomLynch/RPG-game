#!/bin/bash
# The remote-kit program count on the GPU job (node scripts/gpu-run.mjs <sha> -- bash scripts/remote-programs-gpu.sh): build the Origins preview, dress a remote in each kit after zone ready. Artifacts: artifacts/remote-programs/receipt.json.
npx vite build --config origins/preview/vite.config.mjs > /tmp/pv.log 2>&1; echo "PREVIEW-BUILD=$?"
GATE=${GATE-1} node scripts/remote-programs-check.mjs artifacts/origins-preview artifacts/remote-programs
