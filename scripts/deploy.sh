#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing a dirty release'; exit 1; }
node scripts/check-account-config.mjs
# Stage the versioned Frankendom CSP before publishing WASM-compressed assets.
node scripts/check-glb-compression.mjs --hosted-csp
node --input-type=module -e 'import { loadEnv } from "vite"; import { readFileSync } from "node:fs"; const dsn = process.env.VITE_SENTRY_DSN || loadEnv("production", process.cwd()).VITE_SENTRY_DSN; if (!dsn || new URL(dsn).protocol !== "https:" || !readFileSync("deploy/frankendom.com.conf", "utf8").includes(new URL(dsn).origin)) throw new Error("Configure VITE_SENTRY_DSN and its CSP origin before deployment");'
revision=$(git rev-parse HEAD)
export VITE_SENTRY_RELEASE="$revision"
# CI runs `quality:ci` (lint + full suite + build + audit + budget) on every trunk push. When it already passed for
# this exact revision, re-running the 6-minute suite here only duplicates it: run the deploy-only parts instead.
# A merge commit of a rebased branch onto an unmoved trunk has the branch head's tree, so the head's own green
# pull_request run tested this exact code: accept it when the trees are identical (git decides, nothing else).
# Any doubt (gh unavailable, no green run, trees differ) falls back to the full gate.
quality_green() { gh run list --workflow quality.yml --commit "$1" --status success --json url --jq '.[0].url' 2>/dev/null || true; }
ci_green=$(quality_green "$revision")
ci_green_for="$revision"
if [[ -z "$ci_green" ]]; then
  merged_head=$(git rev-parse -q --verify "$revision^2" 2>/dev/null || true)
  if [[ -n "$merged_head" && "$(git rev-parse "$revision^{tree}")" == "$(git rev-parse "$merged_head^{tree}")" ]]; then
    ci_green=$(quality_green "$merged_head")
    ci_green_for="$merged_head (merged branch head, same tree as $revision)"
  fi
fi
if [[ -n "$ci_green" ]]; then
  echo "CI quality is green for $ci_green_for ($ci_green); running quality:deploy"
  npm run quality:deploy
else
  echo "No green CI quality run found for $revision; running the full quality gate"
  npm run quality
fi
# Checks CI already proved for this exact revision (green release-checks job + receipt artifact) are skipped here;
# the rest run locally. Any doubt in the lookup means an empty list and everything runs, as before.
trusted_checks=$(node scripts/ci-trusted-checks.mjs "$revision" || true)
RELEASE_CHECKS_SKIP="$trusted_checks" RELEASE_CHECKS_SKIP_SOURCE="CI release-checks for $revision" node scripts/release-checks.mjs
[[ -z "$(git status --porcelain)" ]] || { echo 'Release checks changed tracked files'; exit 1; }
printf '{"revision":"%s","phase":"0B-swordplay"}\n' "$revision" > dist/release.json
host=root@49.12.7.18
key="$HOME/.ssh/binance_futures_tool"
release="/var/www/frankendom/releases/$revision"
# Reuse one connection for mkdir, transfer and switch; bound failed connection attempts.
ssh_options=(-o BatchMode=yes -o ConnectTimeout=8 -o ControlMaster=auto -o ControlPersist=120 -o ControlPath=/tmp/frankendom-ssh-%C -i "$key")
printf -v remote_shell '%q ' ssh "${ssh_options[@]}"
ssh "${ssh_options[@]}" "$host" "mkdir -p '$release'"
# Hardlink files unchanged since the current release instead of re-uploading the whole dist (the GLBs dominate).
# rsync only links when size, mtime and content match, so a changed asset is always uploaded in full.
link_dest=$(ssh "${ssh_options[@]}" "$host" "readlink -f /var/www/frankendom/current 2>/dev/null || true")
link_args=()
[[ -n "$link_dest" && "$link_dest" != "$release" ]] && link_args=(--link-dest="$link_dest")
rsync -az --checksum "${link_args[@]}" --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "$remote_shell" dist/ "$host:$release/"
ssh "${ssh_options[@]}" "$host" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
test -s "$1/index.html"
cd /var/www/frankendom
if test -L current; then ln -sfn "$(readlink current)" previous; fi
ln -sfn "$1" next
mv -Tf next current
REMOTE
cmp dist/index.html <(curl --fail --silent --show-error https://frankendom.com/)
cmp dist/release.json <(curl --fail --silent --show-error https://frankendom.com/release.json)
printf '\nPublished %s\n' "$revision"
