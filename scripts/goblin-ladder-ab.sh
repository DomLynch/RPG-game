#!/usr/bin/env bash
# Per-rank load-time delta on the BUILT app (Lead 2026-09-27): one vite build per rank file (dist-ab-<rank>), then look-load-ab.mjs
# in dist mode against dist-ab-base (trunk's goblin.glb). Builds are CPU (deploy-lock hook permitting); the A/B runs are one Chromium each.
#   scripts/goblin-ladder-ab.sh build   # the builds only (no browser)
#   scripts/goblin-ladder-ab.sh run     # the A/B runs (browser slot)
set -euo pipefail
# OPP=veteran (2026-09-27): the base dist is per opponent (dist-ab-base-<opp>) because his LOW-kit NOT_WORN scratch (SLOTS) is baked into the
# dist JS and must be identical in both arms; the goblin keeps its original dist-ab-base and dist-ab-<rank> names.
MODE=${1:-build}; OPP=${OPP:-goblin}; SLOTS=${SLOTS:-"'Helmet', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'"}
if [ "$OPP" = goblin ]; then RANKS=${RANKS:-"L2-kobold L3-nain-rouge L4-andvari L5-alberich L6-rumpelstiltskin L7-puck L8-anansi L9-hermes L10-loki"}; BASE=dist-ab-base; dist_for() { echo "dist-ab-$1"; }; else RANKS=${RANKS:-"L2 L3 L4 L5 L7 L8 L9 L10"}; BASE=dist-ab-base-$OPP; dist_for() { echo "dist-ab-$OPP-$1"; }; fi
file_for() { case $OPP-$1 in goblin-L3-*) echo artifacts/goblin-mid-tier/models/goblin-l3-cut-a1024.glb;; *) echo artifacts/looks/$OPP/$OPP-$1.glb;; esac; }
if [ "$MODE" = build ]; then
  trap 'git checkout -- "src/assets/$OPP.glb" src/loot.ts' EXIT
  OPP=$OPP SLOTS=$SLOTS python3 - <<'PY'
import os; p='src/loot.ts'; s=open(p).read(); a="knight: ['Helmet'] };"; b=f"knight: ['Helmet'], {os.environ['OPP']}: [{os.environ['SLOTS']}] }};   // SCRATCH ladder A/B"
assert a in s; open(p,'w').write(s.replace(a,b,1))
PY
  [ -d "$BASE" ] || { git checkout -- "src/assets/$OPP.glb"; npx vite build --outDir "$BASE" --logLevel warn; echo "built $BASE $(date +%T)"; }
  for r in $RANKS; do cp "$(file_for $r)" "src/assets/$OPP.glb"; npx vite build --outDir "$(dist_for $r)" --logLevel warn; echo "built $(dist_for $r) $(date +%T)"; done
else
  for r in $RANKS; do pgrep -f '^bash scripts/deploy.sh' >/dev/null && { echo "deploy in flight, stopping before $r"; exit 3; }; node scripts/look-load-ab.mjs --opponent "$OPP" --dist-base "$BASE" --dist-look "$(dist_for $r)" --runs "${RUNS:-2}" --label "$OPP-$r-load-ab-dist" | tail -1; done
fi
