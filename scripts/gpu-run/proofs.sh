#!/usr/bin/env bash
# The three gpu-run proofs, each its own T4 job (light here: this only calls Hugging Face). Usage: bash scripts/gpu-run/proofs.sh <sha> still|smoke|render|unit
# still : the 375-wide Zone 1 stills (scripts/gpu-run/arena-still.sh)      smoke : scripts/origins-zone1-smoke.mjs      render : one Cycles render on the GPU (--blender)
set -euo pipefail
sha="${1:?sha}"
case "${2:?still|smoke|render|unit}" in
  still) exec node scripts/gpu-run.mjs "$sha" --timeout 25m -- bash scripts/gpu-run/arena-still.sh ;;
  smoke) exec node scripts/gpu-run.mjs "$sha" --timeout 25m -- node scripts/origins-zone1-smoke.mjs ;;
  unit) exec node scripts/gpu-run.mjs "$sha" --timeout 15m -- node --test tests/gpu-run.test.ts ;;
  render) exec node scripts/gpu-run.mjs "$sha" --timeout 25m --blender -- blender -b -P scripts/gpu-run/render-proof.py ;;
  *) echo "usage: proofs.sh <sha> still|smoke|render|unit"; exit 2 ;;
esac
