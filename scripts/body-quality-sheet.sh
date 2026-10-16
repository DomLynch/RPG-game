#!/bin/bash
# Body quality sheet (Lead 2026-10-07): per body, the fight-camera idle lock, an Idle + Attack key-frame sheet and the resource table, via
# character-preview.mjs. Run from a worktree with node_modules linked, under `capture --prio 3 char ./body-quality-sheet.sh`.
#   body-quality-sheet.sh <out-dir> [body ...]      default bodies = the 15 on trunk plus the Legionary from history
set -u
OUT=${1:?out dir}; shift; mkdir -p "$OUT"
BODIES=${*:-warrior veteran knight goblin nightborn witch dwarf pitborn executioner plaguedoctor shieldmaiden minotaur wraith skeleton werewolf legionary-hist}
trap 'rm -f src/assets/legionary-hist.glb' EXIT # the dev server serves /src/assets; never leave the historical body behind
git show 36db0b063:public/herolook/legionary.glb > src/assets/legionary-hist.glb 2>/dev/null || echo "no historical legionary"
for b in $BODIES; do
  f=/src/assets/$b.glb; [ -f "src/assets/$b.glb" ] || { echo "SKIP $b"; continue; }
  echo "== $b"
  timeout 240 node scripts/character-preview.mjs --label "$b" --enemy $f --flat --orientation portrait > "$OUT/$b.flat.txt" 2>&1
  timeout 240 node scripts/character-preview.mjs --label "$b" --src $f --sheet 'Idle:0;Attack:0.25,0.5' --azimuth 0 > "$OUT/$b.sheet.txt" 2>&1
  timeout 240 node scripts/character-preview.mjs --label "$b" --enemy $f > "$OUT/$b.resources.txt" 2>&1
  cp -r artifacts/character/$b "$OUT/" 2>/dev/null
done
echo BODY-SHEET-DONE
