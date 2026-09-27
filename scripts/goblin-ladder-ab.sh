#!/usr/bin/env bash
# Per-rank load-time delta on the BUILT app (Lead 2026-09-27): one vite build per rank file (dist-ab-<rank>), then look-load-ab.mjs
# in dist mode against dist-ab-base (trunk's goblin.glb). Builds are CPU (deploy-lock hook permitting); the A/B runs are one Chromium each.
#   scripts/goblin-ladder-ab.sh build   # the builds only (no browser)
#   scripts/goblin-ladder-ab.sh run     # the A/B runs (browser slot)
set -euo pipefail
MODE=${1:-build}; RANKS=${RANKS:-"L2-kobold L3-nain-rouge L4-andvari L5-alberich L6-rumpelstiltskin L7-puck L8-anansi L9-hermes L10-loki"}
file_for() { case $1 in L3-*) echo artifacts/goblin-mid-tier/models/goblin-l3-cut-a1024.glb;; *) echo artifacts/looks/goblin/goblin-$1.glb;; esac; }
if [ "$MODE" = build ]; then
  trap 'git checkout -- src/assets/goblin.glb' EXIT
  [ -d dist-ab-base ] || { git checkout -- src/assets/goblin.glb; npx vite build --outDir dist-ab-base --logLevel warn; }
  for r in $RANKS; do cp "$(file_for $r)" src/assets/goblin.glb; npx vite build --outDir "dist-ab-$r" --logLevel warn; echo "built dist-ab-$r $(date +%T)"; done
else
  for r in $RANKS; do pgrep -f '^bash scripts/deploy.sh' >/dev/null && { echo "deploy in flight, stopping before $r"; exit 3; }; node scripts/look-load-ab.mjs --opponent goblin --dist-base dist-ab-base --dist-look "dist-ab-$r" --runs "${RUNS:-2}" --label "goblin-$r-load-ab-dist" | tail -1; done
fi
