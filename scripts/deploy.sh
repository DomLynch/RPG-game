#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing a dirty release'; exit 1; }
# One deployer, one Mac: while this runs, the Claude hooks refuse other sessions' browser checks, test suites and bakes
# (the BUSY/FREE handshake, made mechanical). The lock names the revision, the start and this pid; it goes on any exit, and
# a lock whose pid is dead or older than 45 min is ignored by the hooks, so a killed deploy cannot wedge the lanes.
DEPLOY_LOCK="${DEPLOY_LOCK:-$HOME/.claude/state/deploy_in_flight.json}"
mkdir -p "$(dirname "$DEPLOY_LOCK")"
printf '{"revision":"%s","started":"%s","pid":%d,"cwd":"%s"}\n' "$(git rev-parse HEAD)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$$" "$PWD" > "$DEPLOY_LOCK"
source scripts/lib/deploy-ceiling.sh
trap 'rm -f "$DEPLOY_LOCK"; deploy_ceiling_off' EXIT   # deploy_ceiling_off last: it exits 124 when the ceiling fired
deploy_step "preflight"
node scripts/check-account-config.mjs
# Stage the versioned Frankendom CSP before publishing WASM-compressed assets.
node scripts/check-glb-compression.mjs --hosted-csp
node --input-type=module -e 'import { loadEnv } from "vite"; import { readFileSync } from "node:fs"; const dsn = process.env.VITE_SENTRY_DSN || loadEnv("production", process.cwd()).VITE_SENTRY_DSN; if (!dsn || new URL(dsn).protocol !== "https:" || !readFileSync("deploy/frankendom.com.conf", "utf8").includes(new URL(dsn).origin)) throw new Error("Configure VITE_SENTRY_DSN and its CSP origin before deployment");'
revision=$(git rev-parse HEAD)
export VITE_SENTRY_RELEASE="$revision"
# Every PR GitHub calls MERGED must be in this tree (the #358 wrong-base-branch miss); a stacked PR still in flight is only noted.
deploy_step "merged-on-trunk"
node scripts/merged-on-trunk.mjs
# CI runs `quality:ci` (lint + full suite + build + audit + budget) on every trunk push. When it already passed for
# this exact revision, re-running the 6-minute suite here only duplicates it: run the deploy-only parts instead.
# A merge commit of a rebased branch onto an unmoved trunk has the branch head's tree, so the head's own green
# pull_request run tested this exact code: accept it when the trees are identical (git decides, nothing else).
# Any doubt (gh unavailable, no green run, trees differ) falls back to the full gate.
# Green means the REQUIRED quality.yml jobs (`quality`, `browser (combat)`) concluded success on the newest run for the
# revision. Run-level success would wait for the optional counter gate (continue-on-error, often a ~16 min stall).
quality_green() {
  gh run list --workflow quality.yml --commit "$1" --json databaseId,url --limit 3 --jq '.[0] | "\(.databaseId) \(.url)"' 2>/dev/null | {
    read -r run_id run_url || exit 0
    [[ -n "$run_id" ]] || exit 0
    green=$(gh run view "$run_id" --json jobs --jq '[.jobs[] | select(.name == "quality" or .name == "browser (combat)") | .conclusion] | if length == 2 and all(. == "success") then "yes" else "no" end' 2>/dev/null || true)
    [[ "$green" == "yes" ]] && echo "$run_url"
    exit 0
  }
}
ci_green=$(quality_green "$revision")
ci_green_for="$revision"
if [[ -z "$ci_green" ]]; then
  merged_head=$(git rev-parse -q --verify "$revision^2" 2>/dev/null || true)
  if [[ -n "$merged_head" && "$(git rev-parse "$revision^{tree}")" == "$(git rev-parse "$merged_head^{tree}")" ]]; then
    ci_green=$(quality_green "$merged_head")
    ci_green_for="$merged_head (merged branch head, same tree as $revision)"
  fi
fi
deploy_step "quality gate"
if [[ -n "$ci_green" ]]; then
  echo "CI quality is green for $ci_green_for ($ci_green); running quality:deploy"
  npm run quality:deploy
else
  echo "No green CI quality run found for $revision; running the full quality gate"
  npm run quality
fi
# Checks CI already proved for this exact revision (green release-checks job + receipt artifact) are skipped here;
# the rest run locally. Any doubt in the lookup means an empty list and everything runs, as before.
deploy_step "release checks"
trusted_checks=$(node scripts/ci-trusted-checks.mjs "$revision" || true)
RELEASE_CHECKS_SKIP="$trusted_checks" RELEASE_CHECKS_SKIP_SOURCE="CI release-checks for $revision" node scripts/release-checks.mjs
[[ -z "$(git status --porcelain)" ]] || { echo 'Release checks changed tracked files'; exit 1; }
printf '{"revision":"%s","phase":"0B-swordplay"}\n' "$revision" > dist/release.json
# Fight records (#308) carry the rules build id from <html data-release>; "dev" until the deploy stamps the revision.
REVISION="$revision" perl -pi -e 's/ data-release="dev"/ data-release="$ENV{REVISION}"/' dist/index.html
grep -q "data-release=\"$revision\"" dist/index.html || { echo 'data-release stamp missing in dist/index.html'; exit 1; }
host=root@49.12.7.18
key="$HOME/.ssh/binance_futures_tool"
release="/var/www/frankendom/releases/$revision"
# Reuse one connection for mkdir, transfer and switch; bound failed connection attempts.
ssh_options=(-o BatchMode=yes -o ConnectTimeout=8 -o ControlMaster=auto -o ControlPersist=120 -o ControlPath=/tmp/frankendom-ssh-%C -i "$key")
printf -v remote_shell '%q ' ssh "${ssh_options[@]}"
deploy_step "transfer + switch"
ssh "${ssh_options[@]}" "$host" "mkdir -p '$release'"
# Hardlink files unchanged since the current release instead of re-uploading the whole dist (the GLBs dominate).
# rsync only links when size, mtime and content match, so a changed asset is always uploaded in full.
link_dest=$(ssh "${ssh_options[@]}" "$host" "readlink -f /var/www/frankendom/current 2>/dev/null || true")
link_args=()  # expanded guarded below: macOS bash 3.2 treats an empty array as unbound under set -u (a same-revision redeploy)
[[ -n "$link_dest" && "$link_dest" != "$release" ]] && link_args=(--link-dest="$link_dest")
rsync -az --checksum ${link_args[@]+"${link_args[@]}"} --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "$remote_shell" dist/ "$host:$release/"
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
# The daily warden's replay verifier (scripts/verify-daily.mjs) must run the deployed rules: ship the sim source beside the release,
# outside the web root, and (re)install its timer. It runs as the least-privilege role of migration 202609210005 from
# /etc/frankendom/verifier.env (written by hand on the VPS, never in git); until that file exists the timer is left alone.
verifier="/opt/frankendom-verifier/$revision"
deploy_step "verifier"
ssh "${ssh_options[@]}" "$host" "mkdir -p '$verifier/src' '$verifier/scripts'"
rsync -az --delete --include='*/' --include='*.ts' --exclude='*' -e "$remote_shell" src/ "$host:$verifier/src/"
rsync -az -e "$remote_shell" scripts/verify-daily.mjs "$host:$verifier/scripts/"
rsync -az -e "$remote_shell" ops/frankendom-verify-daily.service ops/frankendom-verify-daily.timer "$host:$verifier/"
ssh "${ssh_options[@]}" "$host" bash -s -- "$verifier" <<'REMOTE'
set -euo pipefail
ln -sfn "$1" /opt/frankendom-verifier/current
if test -s /etc/frankendom/verifier.env; then
  test "$(stat -c %U:%a /etc/frankendom/verifier.env)" = root:600 || { echo "/etc/frankendom/verifier.env must be root:600"; exit 1; }
  install -m 644 "$1/frankendom-verify-daily.service" "$1/frankendom-verify-daily.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now --quiet frankendom-verify-daily.timer
  echo "verifier timer armed on $1"
else
  echo "verifier shipped to $1; /etc/frankendom/verifier.env missing, timer not armed"
fi
REMOTE
printf '\nPublished %s\n' "$revision"
