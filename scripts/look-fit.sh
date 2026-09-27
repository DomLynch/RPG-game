#!/usr/bin/env bash
# One GPT tier look, received as a whole-body GLB already on the opponent's rig, made ready for stills + the dist A/B (Armour, 2026-09-27;
# Strategy's recipe = levers 1+2: vertex compaction + 1024 atlases; lever 3 (harder cuts) refused). No Blender, no browser.
#   scripts/look-fit.sh <opponent> <candidate.glb> <label> [--tris 20000] [--match geometry_] [--atlas Image_0,Image_1]   (default: every image wider than 1024)
# Writes artifacts/looks/<label>/{<label>-cut.glb,<label>.glb}, prints the probe + gzip line, installs src/assets/<opponent>.glb (git restores it).
set -euo pipefail
OPP=$1; IN=$2; LABEL=$3; shift 3; TRIS=20000; MATCH=geometry_; ATLAS=""
while [ $# -gt 0 ]; do case $1 in --tris) TRIS=$2; shift 2;; --match) MATCH=$2; shift 2;; --atlas) ATLAS=$2; shift 2;; *) echo "unknown $1"; exit 2;; esac; done
OUT=artifacts/looks/$LABEL; mkdir -p "$OUT"; PY=${PY:-$HOME/.venvs/face/bin/python}; T0=$(date +%s)
git show "origin/codex/01a09a76/task-1:src/assets/$OPP.glb" > "$OUT/$OPP-base-trunk.glb"
echo "== probe (joints/clips vs trunk's $OPP.glb)"; python3 scripts/glb-probe.py "$OUT/$OPP-base-trunk.glb" "$IN" | grep -E "^(joints|clips)|bytes"
echo "== cut + compaction"; node scripts/goblin-l3-cut.mjs --in "$IN" --out "$OUT/$LABEL-cut.glb" --tris "$TRIS" --match "$MATCH" | head -1
echo "== atlases → 1024"; "$PY" scripts/glb-atlas-downscale.py --in "$OUT/$LABEL-cut.glb" --out "$OUT/$LABEL.glb" --max 1024 ${ATLAS:+--only "$ATLAS"} | tail -1
for f in "$OUT/$OPP-base-trunk.glb" "$OUT/$LABEL.glb"; do echo "$f raw=$(stat -f %z "$f") gz=$(gzip -9c "$f" | wc -c | tr -d ' ')"; done
cp "$OUT/$LABEL.glb" "src/assets/$OPP.glb"; echo "installed src/assets/$OPP.glb (git checkout restores trunk's); fit wall $(( $(date +%s) - T0 )) s"
echo "next: stills  node scripts/herolook-game-stills.mjs --opponent $OPP --label $LABEL --only today --frames 28 --every 0.5 [--extra look=foe]"
echo "next: A/B     build dist-ab-base (trunk file) + dist-ab-look, then node scripts/look-load-ab.mjs --opponent $OPP --dist-base dist-ab-base --dist-look dist-ab-look --label $LABEL-load-ab-dist"
