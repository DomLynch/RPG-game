#!/usr/bin/env bash
# The three dungeon kit nodes close up at 375 wide (front, quarter, side, beside a 1.8 m stand-in), one capture job: bash scripts/character/dungeon_stills_job.sh <out dir>
set -euo pipefail
out="${1:?out dir}"
for node in cave_wall cave_doorway bone_pile; do
  node scripts/character/fort-piece-still.mjs "$out" "$node" dungeon-kit.glb
done
