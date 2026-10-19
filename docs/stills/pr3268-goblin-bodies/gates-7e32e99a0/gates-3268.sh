#!/usr/bin/env bash
# #3268's skipped browser set, once at the full sha, as quality.yml runs them (software GL Chromium, one gate after another).
# Runs on the VPS under capture. Own clone, own node_modules (never a symlink into bn-trunk). Results in $D/gates.txt + logs + artifacts.
set -uo pipefail
SHA=${SHA:-7e32e99a0}
BASE=${BASE:-4eb8d8016}
D=/opt/frankendom-shadow/work/tz-3268-gates
rm -rf "$D"; git clone -q /opt/frankendom-shadow/repo "$D"; cd "$D"
git fetch -q https://github.com/DomLynch/RPG-game.git refs/pull/3268/head && git checkout -q "$SHA"
git fetch -q https://github.com/DomLynch/RPG-game.git codex/01a09a76/task-1 || true
FULL=$(git rev-parse HEAD); echo "head $FULL base $(git rev-parse "$BASE")" | tee gates.txt
echo "start $(date -u +%FT%TZ) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a gates.txt
npm ci --no-audit --no-fund > log-npm-ci.txt 2>&1 || { echo "npm ci FAILED" | tee -a gates.txt; exit 1; }
npx playwright install chromium webkit > log-pw.txt 2>&1 || echo "playwright install rc=$? (browsers may already be present)" | tee -a gates.txt
# the base build for load-time, in parallel with the gates (own dir, own node_modules)
( git worktree add -q "$D/base" "$BASE" && cd "$D/base" && npm ci --no-audit --no-fund > ../log-base-npm.txt 2>&1 && npm run build > ../log-base-build.txt 2>&1 && echo "base build ok" > ../base-ok.txt ) &
BASEPID=$!
npm run build > log-build.txt 2>&1 || { echo "head build FAILED" | tee -a gates.txt; exit 1; }
run() { local name=$1; shift; local t0=$(date +%s); "$@" > "log-$name.txt" 2>&1; local rc=$?; echo "$name rc=$rc $(( $(date +%s) - t0 ))s load $(cut -d' ' -f1 /proc/loadavg)" | tee -a gates.txt; }
run combat        node scripts/browser-check.mjs
run stance-panel  node scripts/stance-panel-check.mjs
run counter-slash  env COUNTER_ONLY=slash_riposte node scripts/counter-browser-check.mjs
run counter-thrust env COUNTER_ONLY=riposte node scripts/counter-browser-check.mjs
run counter-heavy  env COUNTER_ONLY=heavy_riposte node scripts/counter-browser-check.mjs
run seamless       node scripts/origins-seamless-check.mjs
run seamless-quiet env SEAMLESS_QUIET=1 SEAMLESS_STRIKE=1 SEAMLESS_PROGRAMS=1 node scripts/origins-seamless-check.mjs
run remote-heroes  node scripts/origins-remote-heroes-check.mjs
run duel-two-page  node scripts/duel-two-page-check.mjs
run net-engines    env NET_FIGHTS=1000 node scripts/net-engines-check.mjs
wait "$BASEPID"; [ -f base-ok.txt ] && echo "base build ok" | tee -a gates.txt || echo "base build FAILED (see log-base-*.txt)" | tee -a gates.txt
mv dist head-dist
run load-time      node scripts/load-time-check.mjs "$D/base/dist" "$D/head-dist"
echo "end $(date -u +%FT%TZ) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a gates.txt
mkdir -p out && cp -r gates.txt log-*.txt out/ 2>/dev/null; for f in artifacts/browser-check.json artifacts/net-engines/receipt.json artifacts/load-time/receipt.json; do [ -f "$f" ] && cp "$f" "out/$(echo "$f" | tr / _)"; done; ls artifacts/*.jpg >/dev/null 2>&1 && cp artifacts/browser-*.jpg out/ 2>/dev/null
echo DONE
