#!/usr/bin/env bash
# The ten-Goblin in-game sheet (Dom via Lead, 2026-09-27): each rank file installed in turn as src/assets/goblin.glb, his LOW kit hidden
# (scratch NOT_WORN), roster cells front (fight-camera side) + back at 420x720 and one ?look=foe 375 frame; then tiled by
# scripts/goblin-ladder-tile.py. ONE Chromium at a time; run only in Armour's browser slot. Restores trunk's goblin.glb + src/loot.ts after.
set -euo pipefail
# OPP=veteran (2026-09-27): any opponent whose rank files sit at artifacts/looks/<opp>/<opp>-<rank>.glb; L1 = trunk's own file; SLOTS = his LOW kit slots hidden.
OPP=${OPP:-goblin}; OUT=artifacts/looks/$OPP/sheet; mkdir -p "$OUT"
if [ "$OPP" = goblin ]; then RANKS=${RANKS:-"L1-sewer-imp L2-kobold L3-nain-rouge L4-andvari L5-alberich L6-rumpelstiltskin L7-puck L8-anansi L9-hermes L10-loki"}; else RANKS=${RANKS:-"L1 L2 L3 L4 L5 L7 L8 L9 L10"}; fi
SLOTS=${SLOTS:-"'Helmet', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'"}
file_for() { case $OPP-$1 in goblin-L1-*) echo artifacts/goblin-mid-tier/models/goblin-base-trunk.glb;; goblin-L3-*) echo artifacts/goblin-mid-tier/models/goblin-l3-cut-a1024.glb;; *-L1) echo artifacts/looks/$OPP/$OPP-base-trunk.glb;; *) echo artifacts/looks/$OPP/$OPP-$1.glb;; esac; }
[ -f "artifacts/looks/$OPP/$OPP-base-trunk.glb" ] || git show "origin/codex/01a09a76/task-1:src/assets/$OPP.glb" > "artifacts/looks/$OPP/$OPP-base-trunk.glb"
restore() { git checkout -- "src/assets/$OPP.glb" src/loot.ts; }; trap restore EXIT
OPP=$OPP SLOTS=$SLOTS python3 - <<'PY'
import os; p='src/loot.ts'; s=open(p).read(); a="knight: ['Helmet'] };"; b=f"knight: ['Helmet'], {os.environ['OPP']}: [{os.environ['SLOTS']}] }};   // SCRATCH ladder sheet"
assert a in s; open(p,'w').write(s.replace(a,b,1))
PY
for r in $RANKS; do
  pgrep -f '^bash scripts/deploy.sh' >/dev/null && { echo "deploy in flight, stopping before $r"; exit 3; }
  cp "$(file_for $r)" "src/assets/$OPP.glb"; echo "== $r $(date +%T)"
  node scripts/armour-contact-sheet.mjs --roster --opponents "$OPP" --tiers Recruit --arena 1 --out "$OUT/roster-$r" | tail -1
  node scripts/herolook-game-stills.mjs --opponent "$OPP" --label "ladder-$OPP-$r" --only today --frames 8 --every 0.5 --extra look=foe | tail -1
done
echo "sheet inputs done $(date +%T); tile: OPP=$OPP RANKS=\"$RANKS\" ~/.venvs/face/bin/python scripts/goblin-ladder-tile.py"
