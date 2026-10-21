#!/usr/bin/env bash
# Finisher-signature bursts, BASE vs AFTER of the wound-ray phone skip, Pit sparring (goblin, ?signature=on&debug), 375 phone UA, real GPU.
# node scripts/gpu-run.mjs <sha with these scripts> --timeout 30m -- bash scripts/gpu-run/pit-sig.sh <base sha> <after sha>
set -uo pipefail
BASE="${1:?base sha}"; AFTER="${2:?after sha}"
mkdir -p artifacts/pit-sig
cp scripts/gpu-run/pit-sig-frames.mjs ./pit-sig-run.mjs
for T in base after; do
  if [ $T = base ]; then REF=$BASE; else REF=$AFTER; fi
  git fetch -q origin "$REF"
  git worktree add -q "/tmp/wt-$T" "$REF"
  ln -s "$PWD/node_modules" "/tmp/wt-$T/node_modules"
  (cd "/tmp/wt-$T" && npx vite build > "/tmp/b-$T.log" 2>&1) || { tail -20 "/tmp/b-$T.log"; exit 1; }
done
for T in base after; do
  echo "######## $T"
  REAL_GPU=1 node ./pit-sig-run.mjs "/tmp/wt-$T/dist" artifacts/pit-sig "$T" 2>&1 | grep -E "PHONE|frames|rror"
done
du -sh artifacts/pit-sig
echo ALLDONE
