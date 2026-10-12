#!/usr/bin/env bash
# The PR preflight, box side (scripts/preflight.mjs ships it to the VPS; tests/preflight.test.ts runs it on fixture repos). Usage, cwd = a checkout holding both commits:
#   preflight-steps.sh <trunk sha> <head sha>
# Merges the PR head into trunk (no commit), then runs each step on the merged tree. A merge conflict is a FAIL naming the files. One line per step, then
#   PREFLIGHT {"head":..,"trunk":..,"steps":{"merge":"pass|fail",...},"conflicts":[..],"ok":true|false}     exit 0 only when every step passed.
# PREFLIGHT_STEPS overrides the step list (newline-separated name=command, for the test); the data gate passes on exit 0 or 1 (1 = a normal PR) and fails on 2.
set -uo pipefail
trunk="${1:?usage: preflight-steps.sh <trunk sha> <head sha>}"; head="${2:?usage: preflight-steps.sh <trunk sha> <head sha>}"
steps="${PREFLIGHT_STEPS:-install=npm ci --no-audit --no-fund
tsc=npx tsc --noEmit -p .
typecheck:tests=npm run -s typecheck:tests
typecheck:origins=npm run -s typecheck:origins
data=node scripts/data-only-check.mjs $trunk; [ \$? -lt 2 ]}"
json_steps=""; conflicts=""; ok=true
add() { json_steps="${json_steps:+$json_steps,}\"$1\":\"$2\""; [ "$2" = pass ] || ok=false; echo "STEP $1 $2"; }
git checkout -q --detach "$trunk" && git reset -q --hard && git clean -fdq || { echo "cannot check out trunk $trunk"; exit 2; }
if git -c user.name=preflight -c user.email=preflight@localhost merge --no-commit --no-ff "$head" > /tmp/preflight-merge.$$ 2>&1; then add merge pass
else
  conflicts=$(git diff --name-only --diff-filter=U | sed 's/.*/"&"/' | paste -sd, -)
  add merge fail; echo "merge conflict in: $(git diff --name-only --diff-filter=U | paste -sd' ' -)"; tail -n 5 /tmp/preflight-merge.$$
fi
rm -f /tmp/preflight-merge.$$
if [ "$ok" = true ]; then
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    name="${line%%=*}"; cmd="${line#*=}"
    if out=$(bash -c "$cmd" 2>&1 < /dev/null); then add "$name" pass; else add "$name" fail; echo "$out" | tail -n 15; fi
  done <<< "$steps"
fi
printf 'PREFLIGHT {"head":"%s","trunk":"%s","steps":{%s},"conflicts":[%s],"ok":%s}\n' "$head" "$trunk" "$json_steps" "$conflicts" "$ok"
[ "$ok" = true ]
