#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing a dirty release'; exit 1; }
# One deployer, one Mac: while this runs, the Claude hooks refuse other sessions' browser checks, test suites and bakes
# (the BUSY/FREE handshake, made mechanical). The lock names the revision, the start and this pid; it goes on any exit, and
# a lock whose pid is dead or older than 45 min is ignored by the hooks, so a killed deploy cannot wedge the lanes.
# Pipelining (scripts/lib/deploy-lock.sh): two runs may be in flight, each in its own checkout; only the publish window is exclusive.
DEPLOY_LOCK="${DEPLOY_LOCK:-$HOME/.claude/state/deploy_in_flight.json}"
mkdir -p "$(dirname "$DEPLOY_LOCK")"
source scripts/lib/deploy-lock.sh
deploy_lock_take "$(git rev-parse HEAD)"
source scripts/lib/deploy-ceiling.sh
source scripts/lib/deploy-trust.sh
source scripts/lib/deploy-hf.sh
source scripts/lib/deploy-vps.sh
source scripts/lib/deploy-notes-only.sh
source scripts/lib/writer-parity.sh   # writer_parity_gaps: the writer on the box must match the closure before the site moves
source scripts/lib/node-pin.sh   # use_pinned_node: a unit suite on the Mac runs under NODE_PIN or not at all
# Nothing is left running (Dom 2026-10-09): on ANY exit, cancel every Hugging Face job this release launched (the ledger, scripts/hf-cleanup.mjs) and print
# "HF: N jobs, 0 running, <=$X"; a job it cannot prove stopped is a RED LINE in the log.
hf_cleanup() { node scripts/hf-cleanup.mjs || echo 'RED LINE: an HF job launched by this release may still be running (hf jobs ps)' >&2; }
trap 'deploy_lock_release; hf_cleanup; deploy_ceiling_off' EXIT   # deploy_ceiling_off last: it exits 124 when the ceiling fired
deploy_trust_check   # after the trap, so a missing reason still releases the lock
deploy_step "preflight"
node scripts/check-account-config.mjs
# Stage the versioned Frankendom CSP before publishing WASM-compressed assets.
node scripts/check-glb-compression.mjs --hosted-csp
node --input-type=module -e 'import { loadEnv } from "vite"; import { readFileSync } from "node:fs"; const dsn = process.env.VITE_SENTRY_DSN || loadEnv("production", process.cwd()).VITE_SENTRY_DSN; if (!dsn || new URL(dsn).protocol !== "https:" || !readFileSync("deploy/frankendom.com.conf", "utf8").includes(new URL(dsn).origin)) throw new Error("Configure VITE_SENTRY_DSN and its CSP origin before deployment");'
revision=$(git rev-parse HEAD)
export VITE_SENTRY_RELEASE="$revision"
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
  skip=$(git diff --name-only "$live" "$revision" | node scripts/release-rows-for.mjs --deploy-skip --base "$live") || { echo "release scope: full (row selection failed)"; return 0; }
  out_of_scope="$skip"
  echo "release scope: changed files $live..$revision, last full run ${age}s ago; rows out of scope: ${skip:-none}"
}
# The waterfall (Dom 2026-10-09: "max out the VPS, the HF CPU and the T4"): every row a remote box may vouch for is launched NOW, so it overlaps the
# quality gate, minus the rows CI already proved and the rows out of this release's scope. T4 wall rows: scripts/hf-wall-rows.mjs (one t4-medium job, its
# GPU guard); CPU rows: launch.mjs cpu (cpu-upgrade shards, 20 m each). The Mac runs the Mac-only list (scripts/lib/row-placement.mjs) and every row no
# receipt proves for this tree. No switch: the list is the only config. The first line says where every row goes.
out_of_scope=""
deploy_scope_apply
early_trusted=$(node scripts/ci-trusted-checks.mjs "$revision" || true)
placed_skip="${early_trusted:+$early_trusted,}$out_of_scope"
hf_wall_rows_launch
cpu_out=$(prelaunched_cpu "$revision" || node scripts/vps-shadow/launch.mjs cpu "$revision" "$placed_skip" || true); hf_cpu_rows=""
if [[ "$cpu_out" == *";"* ]]; then hf_cpu_rows="${cpu_out#*;}"; DEPLOY_HF_ROWS_JOBS="${DEPLOY_HF_ROWS_JOBS:+$DEPLOY_HF_ROWS_JOBS,}${cpu_out%%;*}"; fi
vps_cpu_rows=$(sed -n 2p "${PRELAUNCH_DIR:-$HOME/.claude/state/pre-launch}/${revision}.rowsvps.running" 2>/dev/null || true)   # rows the VPS run is carrying (launch.mjs cpu writes them on line 2)
[[ -n "$vps_cpu_rows" ]] || vps_cpu_rows=$(node -e 'try{const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(r.kind==="vps-rows-live")console.log(r.rows.map(x=>x.n).join(","))}catch{}' "${PRELAUNCH_DIR:-$HOME/.claude/state/pre-launch}/${revision}.rowsvps" 2>/dev/null || true)   # or the finished receipt's rows
node scripts/lib/row-placement.mjs line "$early_trusted" "$out_of_scope" "${hf_wall_planned:-}" "$hf_cpu_rows" "$vps_cpu_rows"
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
# Any of the commit's quality.yml runs counts, not just the newest: a fast-forward of a pre-run candidate (release-V, 2026-10-10) starts a fresh PUSH run for the same sha,
# which sorts first and is still queued, while the PULL REQUEST run that already proved the tree sits second (V's Mac then ran its own unit suite for 3 min).
# A pull_request run whose plan put the browser gates out of scope skips the whole matrix (its job keeps the unexpanded template name), so no
# "browser (combat)" job exists: that run is green when `quality` and `plan` succeeded (release AI, 2026-10-10: script-only, the Mac fell back to its own suite).
quality_green_jq='def c(n): [.jobs[] | select(.name == n) | .conclusion]; if c("quality") == ["success"] and (if (c("browser (combat)") | length) > 0 then c("browser (combat)") == ["success"] else c("plan") == ["success"] and c("browser (${{ matrix.gate.name }})") == ["skipped"] end) then (if (c("browser (combat)") | length) > 0 then "yes" else "scoped" end) else "no" end'
# The first run of "$1" whose verdict is `want` (yes = quality + browser (combat) both success; scoped = browser matrix skipped as out of scope).
quality_run_with() {
  local want="$1" run_id run_url verdict
  while read -r run_id run_url; do
    [[ -n "$run_id" ]] || continue
    verdict=$(gh run view "$run_id" --json jobs --jq "$quality_green_jq" 2>/dev/null || true)
    if [[ "$verdict" == "$want" || "$verdict" == yes ]]; then echo "$run_url"; return 0; fi
  done < <(gh run list --workflow quality.yml --commit "$2" --json databaseId,url --limit 8 --jq '.[] | "\(.databaseId) \(.url)"' 2>/dev/null || true)
  return 0
}
# A scoped run proves only `quality`: the Mac then skips test:browser, so the trunk under this candidate must have had browser (combat) green itself (Auditor LOW on #2136).
# Walk the first parents (<= 8): a member merge of a multi-member candidate has no CI run, the trunk commit under the candidate does; the first commit with a run decides.
# No such commit, its run not green, or gh failing on the walk: fail closed.
quality_green() {
  local url n base runs
  url=$(quality_run_with yes "$1"); if [[ -n "$url" ]]; then echo "$url"; return 0; fi
  url=$(quality_run_with scoped "$1"); [[ -n "$url" ]] || return 0
  for n in 1 2 3 4 5 6 7 8; do
    base=$(git rev-parse -q --verify "$1~$n" 2>/dev/null || true)
    [[ -n "$base" ]] || return 0
    runs=$(gh run list --workflow quality.yml --commit "$base" --json databaseId --limit 1 --jq '.[0].databaseId' 2>/dev/null) || return 0   # a gh error is not "no run": stop, fail closed
    if [[ -n "$runs" ]]; then
      [[ -n "$(quality_run_with yes "$base")" ]] && echo "$url"
      return 0
    fi
  done
  return 0
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
# unit-ci.yml (test:all over 8 GitHub runners) is THE unit receipt (Lead 2026-10-12): scripts/ci-unit-trust.mjs waits for the run on this exact sha (CI_UNIT_WAIT_S,
# default 600 s) rather than looking once (CK looked before its green run finished). Only when it vouches for nothing: the HF/VPS receipts, with reason=unit-ci-down.
vps_unit=$(node scripts/ci-unit-trust.mjs "$revision" || true)
if [[ "$vps_unit" == ok ]]; then
  echo "unit source: unit-ci.yml for $revision"
else
  vps_unit=$(vps_unit_receipt_ok)   # scripts/lib/deploy-vps.sh: a tree-bound unit-suite receipt
  [[ "$vps_unit" == ok ]] || vps_unit=$(vps_unit_live_ok)   # or one run on the prepaid VPS by launch.mjs (VPS first, Hugging Face only as spillover)
  if [[ "$vps_unit" == ok ]]; then echo "unit source: HF/VPS receipt (reason=unit-ci-down)"; else echo "unit source: none (reason=unit-ci-down, no HF/VPS receipt): the Mac runs its own suite"; fi
fi
if [[ -n "$ci_green" && "$vps_unit" == ok ]]; then
  # R ran eslint + build + audit + budget + test:browser here at load 30-35 although CI had proved all of it for this tree (Strategy/Dom 2026-10-10).
  # CI's quality job is quality:static (eslint, both typechecks, test:bot, build, audit, budget), "browser (combat)" is test:browser, and test:all is the
  # unit receipt above (unit-ci.yml owns it since 2026-10-12): all three, or the Mac runs its own suite below. The Mac only builds dist to ship.
  echo "CI quality + browser (combat) green for $ci_green_for ($ci_green) and the unit receipt holds: the Mac skips quality:deploy and test:bot and only builds dist"
  npm run build
elif [[ "$(notes_only_release "$(curl --fail --silent https://frankendom.com/release.json | grep -oE '[0-9a-f]{40}' | head -1 || true)" "$revision")" == ok ]]; then
  echo "notes-only release (every changed path is under docs/state/): no unit suite; build only"
  npm run build
elif [[ "$vps_unit" == ok ]]; then
  echo "unit suite trusted from a tree-bound receipt (VPS, Hugging Face or the CI unit-ci run); running typecheck:tests + quality:deploy (no local test:all)"
  use_pinned_node || exit 1   # test:bot is a sim run: the receipt's node, not the Mac's default
  npm run typecheck:tests
  npm run test:bot   # not in quality:deploy; the receipt covers test:all only
  npm run quality:deploy
elif [[ "${DEPLOY_SCOPE:-changed}" != full ]] && age=$(node scripts/release-rows-for.mjs --full-age . || true) && [[ "$age" =~ ^[0-9]+$ ]] && (( age <= 86400 )); then
  # Change-scoped release (Dom 2026-10-05: a release in about 5 minutes): the fast unit suite instead of test:all; the slow
  # tests run with the daily full release, the same 24 h rule as the browser rows.
  echo "No green CI quality run for $revision; scoped release (last full run ${age}s ago): fast unit suite, test:all with the daily full run"
  # Separate lines: set -e does not stop on a failed non-final command of an && list (Auditor B1 on #1385).
  use_pinned_node || exit 1
  npm run typecheck:tests
  npm test
  npm run quality:deploy
  # Recorded in the full-run stamp (release-checks.mjs): the stamp is about the rows, and a run of every row counts as full
  # even behind the fast unit gate (Lead 2026-10-06; test:all runs on every PR in CI). This replaces Auditor S1 on #1385.
  export DEPLOY_FAST_GATE=1
else
  echo "No green CI quality run found for $revision; running the full quality gate"
  use_pinned_node || exit 1
  npm run quality
fi
# Checks CI already proved for this exact revision (green release-checks job + receipt artifact) are skipped here;
# the rest run locally. Any doubt in the lookup means an empty list and everything runs, as before.
deploy_step "release checks"
# One run's local rows at a time (the other keeps building or publishing). Taken BEFORE the CI lookup: a run that waited trusts what CI finished meanwhile.
deploy_lock_wait "$DEPLOY_ROWS_LOCK" "Mac rows"
trusted_checks=$(CI_ROWS_WAIT_S="${CI_ROWS_WAIT_S:-900}" node scripts/ci-trusted-checks.mjs "$revision" || true)   # waits (bounded) for CI rows still running on this tree (CP, Lead 2026-10-12)
ci_rows="$trusted_checks"   # for the Published summary: which host proved which rows
trust_source="CI release-checks for $revision"
vps_receipts_apply  # scripts/lib/deploy-vps.sh: rows the VPS proved for this exact tree
hf_wall_rows_apply  # scripts/lib/deploy-hf.sh: rows the T4 proved for this exact tree join the trusted list; the rest run here
# The Mac-only rows the train started at the cut (scripts/mac-rows-early.sh, Strategy + Lead 2026-10-12): the ones that passed for this TREE are trusted;
# a run still going is waited for (it holds the Mac-rows lock this run just took, so normally its receipt is already here). The rest run below.
mac_early=$(MAC_ROWS_WAIT_S="${MAC_ROWS_WAIT_S:-600}" node scripts/lib/mac-rows-early.mjs trust "$revision" || true)
if [[ -n "$mac_early" ]]; then trusted_checks="${trusted_checks:+$trusted_checks,}${mac_early%%|*}"; trust_source="$trust_source + Mac rows run at the cut"; fi
deploy_trust_apply  # scripts/lib/deploy-trust.sh
out_of_scope=""
deploy_scope_apply
RELEASE_CHECK_CONCURRENCY="${RELEASE_CHECK_CONCURRENCY:-1}" RELEASE_CHECKS_SKIP="$trusted_checks" RELEASE_CHECKS_SKIP_SOURCE="$trust_source" RELEASE_CHECKS_OUT_OF_SCOPE="$out_of_scope" node scripts/release-checks.mjs   # Mac rows one at a time unless the caller says otherwise (Dom 2026-10-10: the app holds two cores; two WebKit rows at once put the load at 30, X ran 5 wide at 97)
deploy_lock_drop "$DEPLOY_ROWS_LOCK"
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
# The publish window, the only exclusive part of a release: transfer, switch, previews, verifier, summary, prune. The site only moves
# forward (scripts/lib/deploy-lock.sh deploy_publish_order): a candidate live already contains, or one diverged from live, stops here.
deploy_step "publish lock"
deploy_lock_wait "$DEPLOY_PUBLISH_LOCK" "publish"
live_now=$(curl --fail --silent https://frankendom.com/release.json | grep -oE '[0-9a-f]{40}' | head -1 || true)
publish_order=$(deploy_publish_order "$live_now" "$revision")
case "$publish_order" in
  forward) echo "publish order: live ${live_now:0:9} -> $revision (forward)" ;;
  unknown) echo "publish order: live unknown (release.json unreadable); publishing $revision without the order guard" ;;
  superseded) echo "superseded: live $live_now already contains $revision; nothing published"; exit 3 ;;
  *) echo "diverged: live $live_now and $revision do not contain each other; nothing published (re-cut on top of live)" >&2; exit 3 ;;
esac
deploy_step "transfer + switch"
ssh "${ssh_options[@]}" "$host" "mkdir -p '$release'"
# Hardlink files unchanged since the current release instead of re-uploading the whole dist (the GLBs dominate).
# rsync only links when size, mtime and content match, so a changed asset is always uploaded in full.
link_dest=$(ssh "${ssh_options[@]}" "$host" "readlink -f /var/www/frankendom/current 2>/dev/null || true")
link_args=()  # expanded guarded below: macOS bash 3.2 treats an empty array as unbound under set -u (a same-revision redeploy)
[[ -n "$link_dest" && "$link_dest" != "$release" ]] && link_args=(--link-dest="$link_dest")
rsync -az --checksum ${link_args[@]+"${link_args[@]}"} --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "$remote_shell" dist/ "$host:$release/"
# The writer flips with the site, not before or after (2026-10-13 DN: the writer stayed on DM for 4 minutes after the site moved): install it from a box checkout AT this
# revision just before the switch below. --if-changed byte-compares every closure file and skips only a writer that is already identical; a failed install stops here,
# before the site moves.
deploy_step "writer install"
writer_prev=$(ssh "${ssh_options[@]}" "$host" "readlink /opt/frankendom-origins/current || true")
# A switch that fails after the install must not leave the writer ahead of the site: point `current` back at the outgoing writer and restart it (as apply-1880.sh --rollback;
# the install script's own --rollback would stop the writer altogether).
writer_back() {
  [[ -n "$writer_prev" ]] || return 0
  ssh "${ssh_options[@]}" "$host" "$(writer_back_cmd "$writer_prev" "$release")" >&2 || echo "WRITER ROLLBACK FAILED: current may still be ahead of the site; put it back by hand to $writer_prev" >&2
}
# The presence service (ops/install-presence.sh) flips with the site the same way, when it is installed on the box: --if-changed byte-compares its file list and restarts nothing when it is identical.
presence_prev=$(ssh "${ssh_options[@]}" "$host" "readlink /opt/frankendom-presence/current || true")
presence_nr0=$(ssh "${ssh_options[@]}" "$host" "systemctl show -p NRestarts --value frankendom-presence 2>/dev/null || true")
presence_back() {
  [[ -n "$presence_prev" ]] || return 0
  ssh "${ssh_options[@]}" "$host" "$(writer_back_cmd "$presence_prev" "$release" /opt/frankendom-presence /var/www/frankendom frankendom-presence presence nginx)" >&2 || echo "PRESENCE ROLLBACK FAILED: current may still be ahead of the site; put it back by hand to $presence_prev" >&2
}
writer_install=$(ssh "${ssh_options[@]}" "$host" "set -euo pipefail; cd /root/work-1880 && git fetch -q origin '$revision' && git checkout -q -f --detach '$revision' && bash ops/install-origins-writer.sh --if-changed '$revision' 2>&1 | tail -n 3") || { echo "writer install failed for $revision; the site has not moved: $writer_install" >&2; exit 1; }
printf '%s\n' "$writer_install"
if [[ -n "$presence_prev" ]]; then
  presence_install=$(ssh "${ssh_options[@]}" "$host" "set -euo pipefail; cd /root/work-1880 && bash ops/install-presence.sh --if-changed '$revision' 2>&1 | tail -n 3") || { echo "presence install failed for $revision; the site has not moved: $presence_install" >&2; writer_back; presence_back; exit 1; }
  printf '%s\n' "$presence_install"
fi
ssh "${ssh_options[@]}" "$host" bash -s -- "$release" <<'REMOTE' || { writer_back; presence_back; exit 1; }
set -euo pipefail
test -s "$1/index.html"
cd /var/www/frankendom
if test -L current; then ln -sfn "$(readlink current)" previous; fi
# A tab opened on the outgoing release still lazy-loads its hashed chunks (/assets/ is try_files =404): hard-link the outgoing
# release's recent assets (built within 2 days, so history does not pile up) into the new one, never overwriting a file (2026-10-07).
if test -d current/assets; then (cd current/assets && find . -type f -mtime -2 -exec cp -al --update=none --parents {} "$1/assets/" \;); fi
# Carry /preview/ (look-test and Origins previews, published outside any release) into the new release BEFORE the switch: otherwise every
# preview URL 404s (2026-10-07, 09a81037 went live without /preview/). Fails loudly, so the switch never happens without them.
# carry-previews begin
carry_previews() {
  [ -d current/preview ] || return 0
  [ -e "$1/preview" ] || cp -al current/preview "$1/preview"
  [ -d "$1/preview" ] || { echo "carry-previews: $1/preview missing after the carry" >&2; return 1; }
  echo "previews carried: $(find "$1/preview" -mindepth 1 -maxdepth 1 | wc -l | tr -d " ") folders"
}
# carry-previews end
carry_previews "$1"
ln -sfn "$1" next
mv -Tf next current
REMOTE
cmp dist/index.html <(curl --fail --silent --show-error https://frankendom.com/)
cmp dist/release.json <(curl --fail --silent --show-error https://frankendom.com/release.json)
# The previews are published outside a release and carried by carry_previews: a switch that left them 404 must not pass silently. Only
# RECORD it here: exiting now would skip the verifier install below and leave verify-daily and verify-loot on the outgoing sim. The
# failure is raised at the very end of the script, after the release is fully installed.
previews_ok=1
# deploy.sh only carries /preview/ forward, so /zone1/ stayed on an old build for eight releases (A to H). Publish the origins preview from
# this revision now (the checkout is the live revision after the cmp checks above), then require that /zone1/ serves the bundle just built.
# Same rule as above: record the failure, raise it at the end, never skip the verifier install.
if [[ "${DEPLOY_ORIGINS_PREVIEW:-on}" != off ]]; then
  rm -rf artifacts/origins-preview   # a leftover build must never satisfy the bundle compare below (Release I: the publish step failed and a stale build "matched")
  bash scripts/publish-origins-preview.sh || previews_ok=0
  built_bundle=$(ls artifacts/origins-preview/assets 2>/dev/null | grep -m1 '^index-.*\.js$' || true)
  live_bundle=$(curl --fail --silent https://frankendom.com/zone1/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -n 1 | sed 's#^assets/##' || true)
  if [[ -z "$built_bundle" || "$built_bundle" != "$live_bundle" ]]; then
    echo "origins preview: /zone1/ serves '${live_bundle:-none}', this revision built '${built_bundle:-none}'" >&2
    previews_ok=0
  else
    echo "origins preview: /zone1/ serves $live_bundle (built from $revision)"
  fi
fi
# The vhost is installed by scripts/provision.sh, never by this script: Release I's /zone/ alias sat uninstalled until someone curled it. Say so loudly.
nginx_drift=$(bash scripts/provision.sh --dry-run 2>&1 || true)
if [[ -n "$nginx_drift" ]]; then echo "nginx: the installed conf differs from deploy/frankendom.com.conf (run scripts/provision.sh):" >&2; printf '%s\n' "$nginx_drift" | head -n 20 >&2; previews_ok=0; fi
curl --fail --silent --show-error --output /dev/null https://frankendom.com/preview/origins/ || previews_ok=0
# The replay verifiers (scripts/verify-daily.mjs for the daily warden, scripts/verify-loot.mjs for ladder-win loot claims) must run the
# deployed rules: ship the sim source beside the release, outside the web root, and (re)install their timers. It runs as the least-privilege role of migration 202609210005 from
# /etc/frankendom/verifier.env (written by hand on the VPS, never in git); until that file exists the timer is left alone.
verifier="/opt/frankendom-verifier/$revision"
deploy_step "verifier"
# The install is the verifiers' computed import closure (scripts/writer-closure.mjs, shared with the writer), not "src/**/*.ts": CI2 (96a71d70) shipped
# without src/fight/pool-defs.json, imported `with { type: 'json' }`, and both verifiers died ERR_MODULE_NOT_FOUND. An import that resolves to no file stops here.
verifier_files=$(node scripts/writer-closure-list.mjs --paths verifier)
ssh "${ssh_options[@]}" "$host" "mkdir -p '$verifier'"
printf '%s\n' "$verifier_files" | rsync -az --files-from=- -e "$remote_shell" ./ "$host:$verifier/"
rsync -az -e "$remote_shell" ops/frankendom-verify-daily.service ops/frankendom-verify-daily.timer \
  ops/frankendom-verify-loot.service ops/frankendom-verify-loot.timer "$host:$verifier/"
ssh "${ssh_options[@]}" "$host" bash -s -- "$verifier" <<'REMOTE'
set -euo pipefail
# Blue-green: dry-import every installed module with the box's own node BEFORE current flips; a missing file fails here and the old verifier stays live.
# Every installed module under src/ and scripts/ except the two entries (importing them would run a verification; their main guard compares argv[1]).
(cd "$1" && find src scripts -type f \( -name '*.ts' -o -name '*.mjs' \) ! -path scripts/verify-daily.mjs ! -path scripts/verify-loot.mjs -print0 | xargs -0 node --input-type=module -e 'import { pathToFileURL } from "node:url"; for (const f of process.argv.slice(1)) await import(pathToFileURL(f).href);') \
  || { echo "verifier: dry import failed in $1 with $(node --version); current left on $(readlink /opt/frankendom-verifier/current 2>/dev/null || echo none)" >&2; exit 1; }
echo "verifier: dry import ok ($(find "$1/src" "$1/scripts" -type f | wc -l | tr -d ' ') files, node $(node --version))"
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
# Writer parity, after the switch and before Published: the installed writer must be byte-identical to this revision's writer closure.
writer_files=$(node scripts/writer-closure-list.mjs --paths writer) && [[ -n "$writer_files" ]] || { echo 'writer parity: no writer closure list' >&2; exit 1; }
writer_sums=$(while read -r f; do printf '%s %s\n' "$(shasum -a 256 "$f" | cut -c1-16)" "$f"; done <<<"$writer_files")
writer_gaps=$(ssh "${ssh_options[@]}" "$host" "$(declare -f writer_parity_gaps); writer_parity_gaps /opt/frankendom-origins/current" <<<"$writer_sums")
[[ -z "$writer_gaps" ]] || { echo "writer parity: the installed writer differs from $revision in: $(printf '%s' "$writer_gaps" | head -n 8 | tr '\n' ' ')- RED: site moved, writer differs" >&2; exit 1; }
# Presence parity, same rule: the installed presence service must be byte-identical to this revision's presence file list.
if [[ -n "$presence_prev" ]]; then
  presence_files=$(node ops/presence-files.mjs) && [[ -n "$presence_files" ]] || { echo 'presence parity: no presence file list' >&2; exit 1; }
  presence_sums=$(while read -r f; do printf '%s %s\n' "$(shasum -a 256 "$f" | cut -c1-16)" "$f"; done <<<"$presence_files")
  presence_gaps=$(ssh "${ssh_options[@]}" "$host" "$(declare -f writer_parity_gaps); writer_parity_gaps /opt/frankendom-presence/current" <<<"$presence_sums")
  [[ -z "$presence_gaps" ]] || { echo "presence parity: the installed presence service differs from $revision in: $(printf '%s' "$presence_gaps" | head -n 8 | tr '\n' ' ')- RED: site moved, presence differs" >&2; exit 1; }
fi
printf '\nPublished %s\n' "$revision"
# One line Lead reads instead of the log (Dom 2026-10-10: merge to live <= 20 min): minutes from the trunk merge commit to now, minutes deploy.sh ran, and where the rows ACTUALLY ran (the release-checks receipt, not the plan).
merge_epoch=$(git log -1 --format=%ct "$revision" 2>/dev/null || true); now_epoch=$(date +%s)
if [[ "$merge_epoch" =~ ^[0-9]+$ ]]; then merge_to_live="$(( (now_epoch - merge_epoch) / 60 )) min since $(git rev-parse --short=9 "$revision") ($(git rev-parse -q --verify "$revision^2" >/dev/null && echo 'merge commit' || echo 'not a merge commit: its commit time')) was made"; else merge_to_live="unknown (merge commit time unreadable)"; fi
node scripts/lib/published-summary.mjs artifacts/release-checks.json "$ci_rows" "${vps_trusted:-}" "${hf_trusted:-}" "$merge_to_live" "$(( (now_epoch - ${HF_WALL_ROWS_DEPLOY_T0:-$now_epoch}) / 60 ))" "$(node scripts/lib/prelaunch-jobs.mjs orphans "$revision" 2>/dev/null || echo '?')" "${mac_early:-}" || true
# The Published block carries presence's state (Strategy + Lead joint GO): active, restarts before -> after, the local health curl and what release.json says.
if [[ -n "$presence_prev" ]]; then
  presence_state=$(ssh "${ssh_options[@]}" "$host" 'P=$(grep -E "^PRESENCE_PORT=" /etc/frankendom/presence.env 2>/dev/null | cut -d= -f2); echo "active=$(systemctl is-active frankendom-presence) NRestarts=$(systemctl show -p NRestarts --value frankendom-presence) health=$(curl -s -m 8 -o /dev/null -w "%{http_code}" http://127.0.0.1:${P:-8793}/origins/presence/health)"' || echo 'state unreadable')
  echo "Published presence: $presence_state (NRestarts was ${presence_nr0:-?} before this publish) release.json=$(curl -s -m 8 https://frankendom.com/release.json | grep -oE '[0-9a-f]{40}' | head -1)"
fi
# Keep DEPLOY_PRUNE_KEEP releases on the VPS (default 3, Dom 2026-10-08, was 5 since 2026-09-28; "off" skips), current and previous always among them; a failure leaves the release live.
prune_keep="${DEPLOY_PRUNE_KEEP:-3}"
if [[ "$prune_keep" =~ ^[0-9]+$ ]]; then
  ssh "${ssh_options[@]}" "$host" bash -s -- /var/www/frankendom "$prune_keep" < scripts/lib/prune-releases.sh \
    || echo "prune: failed (exit $?), release $revision is live; releases/ left as is"
else
  echo "prune off (DEPLOY_PRUNE_KEEP=$prune_keep)"
fi
deploy_lock_drop "$DEPLOY_PUBLISH_LOCK"   # the next candidate may publish now
if [[ "$previews_ok" != 1 ]]; then
  echo "release $revision is LIVE (verifier installed), previews missing: /preview/origins/ is not 200 or /zone1/ is not serving this revision's bundle" >&2
  exit 1
fi
