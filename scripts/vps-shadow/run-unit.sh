#!/usr/bin/env bash
# Hugging Face job side of the unit-suite receipt (item 3, follow-up to #1911): `npm run test:all` for ONE sha on the shadow checkout, then
# runs/<sha>/unit.json = { kind, tree, job, node, pass, fail, exit, seconds, scripts: { 'run-unit.sh': sha256 of THIS file } }, written ONLY when the suite passed (rc 0) and the tree
# was the target's at the start AND the end. `job` is the HF job id ($JOB_ID); the flavor is never declared here, deploy looks the job up (hf jobs inspect) and compares its command.
# deploy.sh trusts it for the exact TREE only (scripts/lib/vps-receipts.mjs unitReceiptOk). Usage: run-unit.sh <sha>
set -uo pipefail
sha="${1:?usage: run-unit.sh <sha>}"; home="${SHADOW_HOME:-/opt/frankendom-shadow}"; me="$(cd "$(dirname "$0")" && pwd)/run-unit.sh"
cd "$home/repo"; git fetch -q origin; full=$(git rev-parse --verify -q "$sha^{commit}") || { echo "unknown sha $sha"; exit 2; }
git checkout -q --detach "$full"; git reset -q --hard && git clean -fdq
want_tree=$(git rev-parse "$full^{tree}"); [[ "$(git rev-parse HEAD^{tree})" == "$want_tree" ]] || { echo "tree mismatch at start"; exit 3; }
run="$home/runs/$full"; mkdir -p "$run"
lock_now=$(sha256sum package-lock.json | cut -c1-64)
[[ "$(cat "$home/.lock-installed" 2>/dev/null || true)" == "$lock_now" ]] || { npm ci --no-audit --no-fund > "$run/unit-npm-ci.log" 2>&1 || { echo "npm ci failed"; exit 4; }; echo "$lock_now" > "$home/.lock-installed"; }
t0=$(date +%s); npm run test:all > "$run/unit.log" 2>&1; rc=$?
[[ "$(git rev-parse HEAD^{tree})" == "$want_tree" && -z "$(git status --porcelain)" ]] || { echo "tree changed or dirty at end; no receipt"; exit 5; }
[[ $rc -eq 0 ]] || { grep -E '^not ok' "$run/unit.log" | grep -v '# TODO' | head -20; echo "unit suite failed (exit $rc); no receipt"; exit "$rc"; }   # the failing tests name themselves in `hf jobs logs`
node -e '
const fs = require("fs"), c = require("crypto"), log = fs.readFileSync(process.argv[1], "utf8");
const n = k => Number((new RegExp("^# " + k + " (\\d+)", "m").exec(log) || [])[1] ?? -1);
fs.writeFileSync(process.argv[2], JSON.stringify({ kind: "vps-unit-suite", job: process.env.JOB_ID || null, sha: process.argv[3], tree: process.argv[4], node: process.version, pass: n("pass"), fail: n("fail"), exit: Number(process.argv[5]), seconds: Number(process.argv[6]), scripts: { "run-unit.sh": c.createHash("sha256").update(fs.readFileSync(process.argv[7])).digest("hex") } }, null, 1) + "\n");
' "$run/unit.log" "$run/unit.json" "$full" "$(git rev-parse HEAD^{tree})" "$rc" "$(( $(date +%s) - t0 ))" "$me"
echo "unit suite sha=$full exit=$rc -> $run/unit.json"
echo "RECEIPT unit $(tr -d '\n' < "$run/unit.json")"   # the deploy box reads this line back from the job logs (scripts/vps-shadow/launch.mjs fetch); the verifier still inspects the job itself
exit "$rc"
