#!/usr/bin/env bash
# The ten-Goblin in-game sheet (Dom via Lead, 2026-09-27): each rank file installed in turn as src/assets/goblin.glb, his LOW kit hidden
# (scratch NOT_WORN), roster cells front (fight-camera side) + back at 420x720 and one ?look=foe 375 frame; then tiled by
# scripts/goblin-ladder-tile.py. ONE Chromium at a time; run only in Armour's browser slot. Restores trunk's goblin.glb + src/loot.ts after.
set -euo pipefail
OUT=artifacts/looks/goblin/sheet; mkdir -p "$OUT"; RANKS=${RANKS:-"L1-sewer-imp L2-kobold L3-nain-rouge L4-andvari L5-alberich L6-rumpelstiltskin L7-puck L8-anansi L9-hermes L10-loki"}
file_for() { case $1 in L1-*) echo artifacts/goblin-mid-tier/models/goblin-base-trunk.glb;; L3-*) echo artifacts/goblin-mid-tier/models/goblin-l3-cut-a1024.glb;; *) echo artifacts/looks/goblin/goblin-$1.glb;; esac; }
restore() { git checkout -- src/assets/goblin.glb src/loot.ts; }; trap restore EXIT
python3 - <<'PY'
p='src/loot.ts'; s=open(p).read(); a="knight: ['Helmet'] };"; b="knight: ['Helmet'], goblin: ['Helmet', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'] };   // SCRATCH ladder sheet"
assert a in s; open(p,'w').write(s.replace(a,b,1))
PY
for r in $RANKS; do
  pgrep -f '^bash scripts/deploy.sh' >/dev/null && { echo "deploy in flight, stopping before $r"; exit 3; }
  cp "$(file_for $r)" src/assets/goblin.glb; echo "== $r $(date +%T)"
  node scripts/armour-contact-sheet.mjs --roster --opponents goblin --tiers Recruit --arena 1 --out "$OUT/roster-$r" | tail -1
  node scripts/herolook-game-stills.mjs --opponent goblin --label "ladder-$r" --only today --frames 8 --every 0.5 --extra look=foe | tail -1
done
echo "sheet inputs done $(date +%T); tile: ~/.venvs/face/bin/python scripts/goblin-ladder-tile.py"
