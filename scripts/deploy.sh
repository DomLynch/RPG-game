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
source scripts/lib/deploy-trust.sh
source scripts/lib/deploy-hf.sh
trap 'rm -f "$DEPLOY_LOCK"; hf_wall_rows_cancel; deploy_ceiling_off' EXIT   # deploy_ceiling_off last: it exits 124 when the ceiling fired
deploy_trust_check   # after the trap, so a missing reason still releases the lock
deploy_step "preflight"
node scripts/check-account-config.mjs
# Stage the versioned Frankendom CSP before publishing WASM-compressed assets.
node scripts/check-glb-compression.mjs --hosted-csp
node --input-type=module -e 'import { loadEnv } from "vite"; import { readFileSync } from "node:fs"; const dsn = process.env.VITE_SENTRY_DSN || loadEnv("production", process.cwd()).VITE_SENTRY_DSN; if (!dsn || new URL(dsn).protocol !== "https:" || !readFileSync("deploy/frankendom.com.conf", "utf8").includes(new URL(dsn).origin)) throw new Error("Configure VITE_SENTRY_DSN and its CSP origin before deployment");'
revision=$(git rev-parse HEAD)
export VITE_SENTRY_RELEASE="$revision"
# The T4 wall-row job starts now and overlaps the quality gate; its receipts are read at the release-rows step (scripts/lib/deploy-hf.sh).
hf_wall_rows_launch
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
trust_source="CI release-checks for $revision"
hf_wall_rows_apply  # scripts/lib/deploy-hf.sh: rows the T4 proved for this exact tree join the trusted list; the rest run here
deploy_trust_apply  # scripts/lib/deploy-trust.sh
# Change-scoped rows (Dom 2026-10-05): only the rows scripts/release-rows-for.mjs picks for the files changed since the live
# revision run here, about 5. The full 50 run when DEPLOY_SCOPE=full, when the last full run is over 24 h old or unknown, or
# when the live revision is not an ancestor of this one. Any doubt in the lookup means a full run, as before.
deploy_scope_apply() {
  [[ "${DEPLOY_SCOPE:-changed}" != full ]] || { echo "release scope: full (DEPLOY_SCOPE=full)"; return 0; }
  local age live skip
  age=$(node scripts/release-rows-for.mjs --full-age . || true)
  [[ "$age" =~ ^-?[0-9]+$ ]] || age=-1
  if (( age < 0 || age > 86400 )); then echo "release scope: full (last full run ${age}s ago; over 24 h or none)"; return 0; fi
  live=$(curl --fail --silent --show-error https://frankendom.com/release.json | grep -oE '[0-9a-f]{40}' | head -1 || true)
  if [[ -z "$live" ]] || ! git merge-base --is-ancestor "$live" "$revision" 2>/dev/null; then
    echo "release scope: full (live revision ${live:-unknown} is not an ancestor of $revision)"; return 0
  fi
  skip=$(git diff --name-only "$live" "$revision" | node scripts/release-rows-for.mjs --deploy-skip) || { echo "release scope: full (row selection failed)"; return 0; }
  out_of_scope="$skip"
  echo "release scope: changed files $live..$revision, last full run ${age}s ago; rows out of scope: ${skip:-none}"
}
out_of_scope=""
deploy_scope_apply
RELEASE_CHECKS_SKIP="$trusted_checks" RELEASE_CHECKS_SKIP_SOURCE="$trust_source" RELEASE_CHECKS_OUT_OF_SCOPE="$out_of_scope" node scripts/release-checks.mjs
hf_wall_rows_table
[[ -z "$(git status --porcelain)" ]] || { echo 'Release checks changed tracked files'; exit 1; }
# The env check above passes a guest-only build; the bundle about to ship must carry accounts (2026-09-24 incident).
node scripts/check-built-account.mjs dist
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
# The replay verifiers (scripts/verify-daily.mjs for the daily warden, scripts/verify-loot.mjs for ladder-win loot claims) must run the
# deployed rules: ship the sim source beside the release, outside the web root, and (re)install their timers. It runs as the least-privilege role of migration 202609210005 from
# /etc/frankendom/verifier.env (written by hand on the VPS, never in git); until that file exists the timer is left alone.
verifier="/opt/frankendom-verifier/$revision"
deploy_step "verifier"
ssh "${ssh_options[@]}" "$host" "mkdir -p '$verifier/src' '$verifier/scripts'"
rsync -az --delete --include='*/' --include='*.ts' --exclude='*' -e "$remote_shell" src/ "$host:$verifier/src/"
rsync -az -e "$remote_shell" scripts/verify-daily.mjs scripts/verify-loot.mjs "$host:$verifier/scripts/"
rsync -az -e "$remote_shell" ops/frankendom-verify-daily.service ops/frankendom-verify-daily.timer \
  ops/frankendom-verify-loot.service ops/frankendom-verify-loot.timer "$host:$verifier/"
ssh "${ssh_options[@]}" "$host" bash -s -- "$verifier" <<'REMOTE'
set -euo pipefail
ln -sfn "$1" /opt/frankendom-verifier/current
if test -s /etc/frankendom/verifier.env; then
  test "$(stat -c %U:%a /etc/frankendom/verifier.env)" = root:600 || { echo "/etc/frankendom/verifier.env must be root:600"; exit 1; }
  install -m 644 "$1/frankendom-verify-daily.service" "$1/frankendom-verify-daily.timer" \
    "$1/frankendom-verify-loot.service" "$1/frankendom-verify-loot.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now --quiet frankendom-verify-daily.timer
  echo "daily verifier timer armed on $1"
  # The loot sweep reads loot_claims (migration 202609230001): arm it only once that table exists, so a publish before the apply is harmless.
  db=$(sed -n 's/^DATABASE_URL=//p' /etc/frankendom/verifier.env | head -n 1 | sed 's/^"\(.*\)"$/\1/')
  if ! loot=$(psql "$db" -tAc "select to_regclass('public.loot_claims') is not null" 2>&1); then
    echo "loot verifier shipped to $1; loot_claims check failed, timer not armed: $(printf '%s' "$loot" | head -n 1 | cut -c1-200)"
  elif test "$loot" = t; then
    systemctl enable --now --quiet frankendom-verify-loot.timer
    echo "loot verifier timer armed on $1"
  else
    echo "loot verifier shipped to $1; public.loot_claims missing (202609230001 not applied), timer not armed"
  fi
else
  echo "verifiers shipped to $1; /etc/frankendom/verifier.env missing, timers not armed"
fi
REMOTE
printf '\nPublished %s\n' "$revision"
# Keep DEPLOY_PRUNE_KEEP releases on the VPS (default 5, Dom 2026-09-28; "off" skips), current and previous always among them; a failure leaves the release live.
prune_keep="${DEPLOY_PRUNE_KEEP:-5}"
if [[ "$prune_keep" =~ ^[0-9]+$ ]]; then
  ssh "${ssh_options[@]}" "$host" bash -s -- /var/www/frankendom "$prune_keep" < scripts/lib/prune-releases.sh \
    || echo "prune: failed (exit $?), release $revision is live; releases/ left as is"
else
  echo "prune off (DEPLOY_PRUNE_KEEP=$prune_keep)"
fi
