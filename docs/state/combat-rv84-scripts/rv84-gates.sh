#!/bin/bash
# RV84 PR 3394 @f5045cf71: run-once browser rows (Lead's list) + the zone probe, in the combat-clips worktree (own node_modules). One gate after another, software GL.
W=/opt/frankendom-shadow/work
D=$W/combat-clips
OUT=$W/combat-rv84-gates
rm -rf "$OUT"; mkdir -p "$OUT"; S="$OUT/gates.txt"; : > "$S"
cd "$D" || exit 2
SHA=f5045cf71d900169bd6e69a32473560f88d4915b
git fetch -q https://github.com/DomLynch/RPG-game.git combat/rv84-world-picked && git checkout -q -f "$SHA" || exit 2
cp $W/zone1-world-special-probe.mjs scripts/zone1-world-special-probe.mjs
echo "head $(git log -1 --format=%H) start $(date -u +%FT%TZ) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a "$S"
npm run build > "$OUT/build.log" 2>&1 || { echo "game build FAILED" | tee -a "$S"; exit 1; }
npx vite build --config origins/preview/vite.config.mjs > "$OUT/build-origins.log" 2>&1 || echo "origins preview build FAILED" | tee -a "$S"
run() { local name=$1; shift; local t0=$(date +%s); "$@" > "$OUT/log-$name.txt" 2>&1; local rc=$?; echo "$name rc=$rc $(( $(date +%s) - t0 ))s load $(cut -d' ' -f1 /proc/loadavg)" | tee -a "$S"; }
# the zone probe first (the headline receipt)
ORIGINS_DIST=$(grep -o 'artifacts/origins-preview[^ ]*' "$OUT/build-origins.log" | head -1)
[ -d artifacts/origins-preview ] && ORIGINS_DIST=artifacts/origins-preview
run zone-probe env SKILL=cleave node scripts/zone1-world-special-probe.mjs "${ORIGINS_DIST:-artifacts/origins-preview}" "$OUT/zone"
run combat        node scripts/browser-check.mjs
run stance-panel  node scripts/stance-panel-check.mjs
run counter-slash  env COUNTER_ONLY=slash_riposte node scripts/counter-browser-check.mjs
run counter-thrust env COUNTER_ONLY=riposte node scripts/counter-browser-check.mjs
run counter-heavy  env COUNTER_ONLY=heavy_riposte node scripts/counter-browser-check.mjs
run seamless-quiet env SEAMLESS_QUIET=1 SEAMLESS_STRIKE=1 SEAMLESS_PROGRAMS=1 node scripts/origins-seamless-check.mjs
# quiet-one rows 16/21/28 with trunk's script (as the rows are today)
run quiet-16 node scripts/quiet-one-browser-check.mjs --finisher splitCrown --opponent goblin
run quiet-21 node scripts/quiet-one-browser-check.mjs --finisher opened --opponent goblin --blood-check
run quiet-28 node scripts/quiet-one-browser-check.mjs --finisher decapitation --opponent goblin --blood-check
echo "end $(date -u +%FT%TZ) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a "$S"
echo DONE >> "$S"
