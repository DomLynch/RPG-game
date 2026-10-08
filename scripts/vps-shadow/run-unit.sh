#!/usr/bin/env bash
# VPS side of the unit-suite receipt (item 3, follow-up to #1911): `npm run test:all` for ONE sha on the shadow checkout, then
# runs/<sha>/unit.json = { kind, tree, flavor, node, pass, fail, exit, seconds, scripts: { 'run-unit.sh': sha256 of THIS file } }.
# deploy.sh trusts it for the exact TREE only (scripts/lib/vps-receipts.mjs unitReceiptOk). Usage: run-unit.sh <sha>
set -uo pipefail
sha="${1:?usage: run-unit.sh <sha>}"; home="${SHADOW_HOME:-/opt/frankendom-shadow}"; me="$(cd "$(dirname "$0")" && pwd)/run-unit.sh"
cd "$home/repo"; git fetch -q origin; full=$(git rev-parse --verify -q "$sha^{commit}") || { echo "unknown sha $sha"; exit 2; }
git checkout -q --detach "$full"; git reset -q --hard && git clean -fdq
run="$home/runs/$full"; mkdir -p "$run"
lock_now=$(sha256sum package-lock.json | cut -c1-64)
[[ "$(cat "$home/.lock-installed" 2>/dev/null || true)" == "$lock_now" ]] || { npm ci --no-audit --no-fund > "$run/unit-npm-ci.log" 2>&1 && echo "$lock_now" > "$home/.lock-installed"; }
t0=$(date +%s); npm run test:all > "$run/unit.log" 2>&1; rc=$?
node -e '
const fs = require("fs"), c = require("crypto"), log = fs.readFileSync(process.argv[1], "utf8");
const n = k => Number((new RegExp("^# " + k + " (\\d+)", "m").exec(log) || [])[1] ?? -1);
fs.writeFileSync(process.argv[2], JSON.stringify({ kind: "vps-unit-suite", flavor: process.env.SHADOW_FLAVOR || "vps-cpu", sha: process.argv[3], tree: process.argv[4], node: process.version, pass: n("pass"), fail: n("fail"), exit: Number(process.argv[5]), seconds: Number(process.argv[6]), scripts: { "run-unit.sh": c.createHash("sha256").update(fs.readFileSync(process.argv[7])).digest("hex") } }, null, 1) + "\n");
' "$run/unit.log" "$run/unit.json" "$full" "$(git rev-parse HEAD^{tree})" "$rc" "$(( $(date +%s) - t0 ))" "$me"
echo "unit suite sha=$full exit=$rc -> $run/unit.json"; exit "$rc"
