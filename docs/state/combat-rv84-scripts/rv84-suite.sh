#!/bin/bash
# usage: rv84-suite.sh <sha>: full unit suite + tsc + as-data at the pushed sha, in the combat-clips worktree (own node_modules).
W=/opt/frankendom-shadow/work
D=$W/combat-clips
OUT=$W/combat-rv84-out
mkdir -p "$OUT"; : > "$OUT/summary"
cd "$D" || exit 2
git fetch -q https://github.com/DomLynch/RPG-game.git combat/rv84-world-picked && git checkout -q -f "$1" || exit 2
echo "head $(git log -1 --format=%h)" >> "$OUT/summary"
npx tsc --noEmit > "$OUT/tsc.log" 2>&1; echo "tsc rc=$?" >> "$OUT/summary"
npm run check:as-data -- --gate > "$OUT/asdata.log" 2>&1; echo "as-data rc=$?" >> "$OUT/summary"
node --test --test-skip-pattern='\[slow\]' tests/*.test.ts > "$OUT/suite.log" 2>&1; echo "suite rc=$? $(grep -E '^# (tests|pass|fail)' "$OUT/suite.log" | tr '\n' ' ')" >> "$OUT/summary"
grep -E '^not ok' "$OUT/suite.log" | head -40 >> "$OUT/summary"
echo DONE >> "$OUT/summary"
