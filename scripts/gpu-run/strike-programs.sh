#!/usr/bin/env bash
# Programs linked at the first strike, on a T4 (real GPU), the checked-out tree built UNMINIFIED, iPhone UA, 4x CPU and 1x:
# node scripts/gpu-run.mjs <sha with this script> --timeout 30m -- bash scripts/gpu-run/strike-programs.sh
set -uo pipefail
mkdir -p artifacts/strike-programs
npx vite build --minify false --config origins/preview/vite.config.mjs > /tmp/b-strike.log 2>&1 || { tail -20 /tmp/b-strike.log; exit 1; }
for R in 4 1; do
  echo "######## rate $R"
  REAL_GPU=1 CPU_RATE=$R node scripts/strike-programs.mjs "$PWD" "artifacts/strike-programs/strike-rate$R.json" 2>&1 | grep -v "GL Driver"
done
echo ALLDONE
